const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProjectScanner {
  /**
   * Scan a Laravel project and extract information
   * @param {string} projectPath - Path to Laravel project
   * @returns {Promise<Object>} Project information
   */
  static async scan(projectPath) {
    try {
      // Validate project path
      if (!fs.existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      const artisanPath = path.join(projectPath, 'artisan');
      const composerPath = path.join(projectPath, 'composer.json');

      // Check for artisan file
      if (!fs.existsSync(artisanPath)) {
        throw new Error('Not a Laravel project: artisan file not found');
      }

      // Check for composer.json
      if (!fs.existsSync(composerPath)) {
        throw new Error('Not a Laravel project: composer.json not found');
      }

      // Parse composer.json
      const composerData = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));

      // Get Laravel version
      const laravelVersion = this.extractLaravelVersion(composerData);

      // Get artisan commands
      const artisanCommands = await this.getArtisanCommands(projectPath);

      // Check for storage link
      const storageLinkExists = fs.existsSync(path.join(projectPath, 'public', 'storage'));

      // Get queue configuration
      const queues = this.extractQueues(projectPath);

      // Get scheduled commands
      const scheduled = this.extractScheduledCommands(projectPath);

      // Check for major Laravel packages
      const packages = this.detectMajorPackages(composerData);

      return {
        path: projectPath,
        name: path.basename(projectPath),
        laravel_version: laravelVersion,
        artisan_commands: artisanCommands,
        queues,
        scheduled,
        packages,
        missing_storage_link: !storageLinkExists,
        scanned_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to scan project: ${error.message}`);
    }
  }

  /**
   * Extract Laravel version from composer.json
   */
  static extractLaravelVersion(composerData) {
    const laravelDep = composerData.require?.['laravel/framework'];
    if (laravelDep) {
      // Extract version number from constraint like "^10.0"
      const match = laravelDep.match(/(\d+\.\d+)/);
      return match ? match[1] : laravelDep;
    }
    return 'unknown';
  }

  /**
   * Get list of artisan commands
   */
  static async getArtisanCommands(projectPath) {
    try {
      const { stdout } = await execAsync('php artisan list --format=json', {
        cwd: projectPath,
        timeout: 10000
      });

      const data = JSON.parse(stdout);
      
      // Extract custom commands (not Laravel default ones)
      const commands = data.commands
        .filter(cmd => !cmd.name.startsWith('_') && !this.isDefaultCommand(cmd.name))
        .map(cmd => ({
          name: cmd.name,
          description: cmd.description || '',
          hidden: cmd.hidden || false
        }));

      return commands;
    } catch (error) {
      console.error('Failed to get artisan commands:', error.message);
      return [];
    }
  }

  /**
   * Check if command is a default Laravel command
   */
  static isDefaultCommand(name) {
    const defaultPrefixes = [
      'cache:', 'config:', 'db:', 'env:', 'event:', 'key:', 'make:',
      'migrate:', 'optimize:', 'package:', 'queue:', 'route:', 'schedule:',
      'schema:', 'session:', 'storage:', 'vendor:', 'view:'
    ];
    
    return defaultPrefixes.some(prefix => name.startsWith(prefix));
  }

  /**
   * Extract queue names from configuration
   */
  static extractQueues(projectPath) {
    try {
      const queueConfigPath = path.join(projectPath, 'config', 'queue.php');
      if (fs.existsSync(queueConfigPath)) {
        // Basic extraction - could be improved with PHP parsing
        const content = fs.readFileSync(queueConfigPath, 'utf-8');
        const matches = content.match(/'queue'\s*=>\s*'([^']+)'/g);
        
        const queues = new Set(['default']);
        if (matches) {
          matches.forEach(match => {
            const queueName = match.match(/'([^']+)'/)[1];
            queues.add(queueName);
          });
        }
        
        return Array.from(queues);
      }
    } catch (error) {
      console.error('Failed to extract queues:', error.message);
    }
    
    return ['default'];
  }

  /**
   * Extract scheduled commands from Kernel
   */
  static extractScheduledCommands(projectPath) {
    try {
      const kernelPath = path.join(projectPath, 'app', 'Console', 'Kernel.php');
      if (fs.existsSync(kernelPath)) {
        const content = fs.readFileSync(kernelPath, 'utf-8');
        
        // Simple pattern matching for scheduled commands
        const commandPattern = /\$schedule->command\('([^']+)'/g;
        const scheduled = [];
        let match;
        
        while ((match = commandPattern.exec(content)) !== null) {
          scheduled.push(match[1]);
        }
        
        return scheduled;
      }
    } catch (error) {
      console.error('Failed to extract scheduled commands:', error.message);
    }
    
    return [];
  }

  /**
   * Detect major Laravel packages
   */
  static detectMajorPackages(composerData) {
    const majorPackages = [
      'laravel/telescope',
      'laravel/nova',
      'laravel/sanctum',
      'laravel/passport',
      'laravel/horizon',
      'laravel/scout',
      'laravel/socialite',
      'spatie/laravel-permission',
      'barryvdh/laravel-debugbar'
    ];

    const installed = [];
    const allDependencies = {
      ...composerData.require,
      ...composerData['require-dev']
    };

    majorPackages.forEach(pkg => {
      if (allDependencies[pkg]) {
        installed.push({
          name: pkg,
          version: allDependencies[pkg]
        });
      }
    });

    return installed;
  }
}

module.exports = ProjectScanner;
