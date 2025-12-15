const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);
const ConfigService = require('./ConfigService');

class QueueService {
  constructor() {
    this.workers = new Map(); // projectId -> ChildProcess
  }

  getWorkerStatus(projectId) {
    return this.workers.has(projectId) ? 'running' : 'stopped';
  }

  startWorker(projectId, projectPath, onOutput) {
    if (this.workers.has(projectId)) {
      return { success: false, error: 'Worker already running' };
    }

    const phpPath = ConfigService.get('php.path') || 'php';
    const worker = spawn(phpPath, ['artisan', 'queue:work'], {
      cwd: projectPath,
      shell: true
    });

    worker.stdout.on('data', (data) => {
      if (onOutput) onOutput(data.toString());
    });

    worker.stderr.on('data', (data) => {
      if (onOutput) onOutput(data.toString());
    });

    worker.on('close', (code) => {
      this.workers.delete(projectId);
      if (onOutput) onOutput(`Worker stopped with code ${code}`);
    });

    this.workers.set(projectId, worker);
    return { success: true };
  }

  stopWorker(projectId) {
    const worker = this.workers.get(projectId);
    if (worker) {
      worker.kill();
      this.workers.delete(projectId);
      return { success: true };
    }
    return { success: false, error: 'No worker running' };
  }

  async getFailedJobs(projectPath) {
    const scriptPath = path.join(projectPath, '_devctl_queue_monitor.php');
    
    const phpCode = `<?php
    define('LARAVEL_START', microtime(true));
    require __DIR__.'/vendor/autoload.php';
    $app = require_once __DIR__.'/bootstrap/app.php';
    $kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
    $kernel->bootstrap();

    try {
        $jobs = \\Illuminate\\Support\\Facades\\DB::table('failed_jobs')
            ->orderBy('id', 'desc')
            ->take(50)
            ->get();
        echo json_encode(['success' => true, 'data' => $jobs]);
    } catch (\\Throwable $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    `;

    try {
      fs.writeFileSync(scriptPath, phpCode);
      const phpPath = ConfigService.get('php.path') || 'php';
      const { stdout } = await execAsync(`"${phpPath}" _devctl_queue_monitor.php`, { cwd: projectPath });
      try { fs.unlinkSync(scriptPath); } catch(e) {}

      // Parse output
      try {
          // Find JSON in output
          const jsonMatch = stdout.match(/\{.*\}/s);
          if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              if (result.success) return result.data;
              throw new Error(result.error);
          }
          return [];
      } catch (e) {
          throw new Error('Failed to parse queue monitor output: ' + stdout.substring(0, 100));
      }

    } catch (error) {
      try { fs.unlinkSync(scriptPath); } catch(e) {}
      throw error;
    }
  }

  async retryJob(projectPath, id) {
    try {
      const phpPath = ConfigService.get('php.path') || 'php';
      await execAsync(`"${phpPath}" artisan queue:retry ${id}`, { cwd: projectPath });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async forgetJob(projectPath, id) {
    try {
      const phpPath = ConfigService.get('php.path') || 'php';
      await execAsync(`"${phpPath}" artisan queue:forget ${id}`, { cwd: projectPath });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async flushFailed(projectPath) {
    try {
        const phpPath = ConfigService.get('php.path') || 'php';
        await execAsync(`"${phpPath}" artisan queue:flush`, { cwd: projectPath });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
  }
}

module.exports = new QueueService();
