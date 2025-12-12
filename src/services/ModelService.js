const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ModelService {
  async runAudit(projectPath) {
    const scriptPath = path.join(projectPath, '_devctl_model_audit.php');
    
    // PHP Script to introspect models
    const phpCode = `<?php
// Quietly bootstrap Laravel
define('LARAVEL_START', microtime(true));
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

$results = [];

// 1. Find Model Files
$modelPath = __DIR__.'/app/Models';
if (!is_dir($modelPath)) {
    // Fallback for older Laravel
    $modelPath = __DIR__.'/app';
}

$files = [];
if (is_dir($modelPath)) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($modelPath));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $files[] = $file->getPathname();
        }
    }
}

foreach ($files as $file) {
    // Basic namespace resolution
    $content = file_get_contents($file);
    if (preg_match('/namespace\\s+(.+?);/', $content, $matches) && preg_match('/class\\s+(\\w+)/', $content, $classMatches)) {
        $namespace = $matches[1];
        $className = $classMatches[1];
        $fullClass = $namespace . '\\\\' . $className;
        
        // Skip non-models (heuristics)
        if (!is_subclass_of($fullClass, 'Illuminate\\Database\\Eloquent\\Model')) {
            continue;
        }

        try {
            // Use Reflection to check for abstract classes
            $reflection = new ReflectionClass($fullClass);
            if ($reflection->isAbstract()) {
                $results[] = [
                    'class' => $fullClass,
                    'file' => $file,
                    'status' => 'abstract',
                    'error' => 'Abstract Class (skipped)'
                ];
                continue;
            }

            // Instantiate to inspect
            $model = new $fullClass;
            $table = $model->getTable();
            
            // Get DB Info
            $count = 0;
            $columns = [];
            
            try {
                $count = $model->count();
                $columns = \\Illuminate\\Support\\Facades\\Schema::getColumnListing($table);
            } catch (\\Throwable $dbEx) {
                // DB might be down or table missing
                $dbError = $dbEx->getMessage();
            }

            $results[] = [
                'class' => $fullClass,
                'file' => $file,
                'table' => $table,
                'rows' => $count,
                'columns' => $columns,
                'fillable' => $model->getFillable(),
                'casts' => $model->getCasts(),
                'db_error' => $dbError ?? null
            ];
        } catch (\\Throwable $e) {
             $results[] = [
                'class' => $fullClass,
                'error' => $e->getMessage()
            ];
        }
    }
}

echo json_encode($results);
`;

    try {
      // Write script
      fs.writeFileSync(scriptPath, phpCode);

      // Run script
      const { stdout, stderr } = await execAsync('php _devctl_model_audit.php', { 
        cwd: projectPath,
        maxBuffer: 1024 * 1024 * 10 
      });

      // Cleanup
      try { fs.unlinkSync(scriptPath); } catch(e) {}

      // Parse output
      try {
        // Find JSON in output (sometimes there's noise)
        const jsonMatch = stdout.match(/\[.*\]/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(stdout);
      } catch (parseError) {
        throw new Error('Failed to parse model audit output: ' + stdout.substring(0, 200) + '...');
      }

    } catch (error) {
      // Ensure cleanup
      try { fs.unlinkSync(scriptPath); } catch(e) {}
      throw error;
    }
  }
}

module.exports = new ModelService();
