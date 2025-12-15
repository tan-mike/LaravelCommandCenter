const ArtisanBridge = require('./ArtisanBridge');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ConfigService = require('./ConfigService');

class DoctorService {
  /**
   * Run all health checks
   * @param {string} projectPath 
   */
  async runChecks(projectPath) {
    const checks = [];

    // 1. PHP Version
    checks.push(await this.checkPhpVersion(projectPath));

    // 2. Application Key
    checks.push(await this.checkAppKey(projectPath));

    // 3. Directory Permissions (Storage & Cache)
    checks.push(await this.checkDirectoryWritable(projectPath, 'storage'));
    checks.push(await this.checkDirectoryWritable(projectPath, 'bootstrap/cache'));

    // 4. Database Connection
    checks.push(await this.checkDatabase(projectPath));

    // 5. Config Cache Status
    checks.push(await this.checkConfigCache(projectPath));

    return checks;
  }

  async checkPhpVersion(cwd) {
    try {
      const phpPath = ConfigService.get('php.path') || 'php';
      const { stdout } = await execAsync(`"${phpPath}" -v`, { cwd });
      const version = stdout.match(/PHP ([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
      return {
        id: 'php_version',
        label: 'PHP Version',
        status: version ? 'ok' : 'warning',
        message: version ? `Running PHP ${version}` : 'Could not detect PHP version',
        meta: { version }
      };
    } catch (e) {
      return {
        id: 'php_version',
        label: 'PHP Version',
        status: 'error',
        message: 'PHP not found or failed to run',
        error: e.message
      };
    }
  }

  async checkAppKey(projectPath) {
    try {
      const envPath = path.join(projectPath, '.env');
      if (!fs.existsSync(envPath)) {
        return { id: 'app_key', label: 'Application Key', status: 'error', message: '.env file not found' };
      }
      
      const envContent = fs.readFileSync(envPath, 'utf8');
      const hasKey = envContent.includes('APP_KEY=base64:') || (envContent.includes('APP_KEY=') && envContent.match(/APP_KEY=\S{10,}/));
      
      return {
        id: 'app_key',
        label: 'Application Key',
        status: hasKey ? 'ok' : 'error',
        message: hasKey ? 'APP_KEY is set' : 'APP_KEY is missing or empty'
      };
    } catch (e) {
      return { id: 'app_key', label: 'Application Key', status: 'error', message: 'Failed to check .env', error: e.message };
    }
  }

  async checkDirectoryWritable(projectPath, dirName) {
    const fullPath = path.join(projectPath, dirName);
    try {
        // Simple check: try to open the directory for writing (fs.access with W_OK)
        await fs.promises.access(fullPath, fs.constants.W_OK);
        return {
            id: `dir_${dirName.replace('/', '_')}`,
            label: `Directory: ${dirName}`,
            status: 'ok',
            message: 'Writable'
        };
    } catch (e) {
        return {
            id: `dir_${dirName.replace('/', '_')}`,
            label: `Directory: ${dirName}`,
            status: 'error',
            message: 'Not writable or does not exist',
            error: e.message
        };
    }
  }

  async checkDatabase(projectPath) {
      // Use migrate:status as a proxy for DB connection
      try {
          // migrate:status might fail if DB is down
          const result = await ArtisanBridge.execute(projectPath, 'migrate:status');
          if (result.success) {
              return {
                  id: 'database',
                  label: 'Database Connection',
                  status: 'ok',
                  message: 'Connected successfully'
              };
          } else {
              return {
                  id: 'database',
                  label: 'Database Connection',
                  status: 'error',
                  message: 'Connection failed',
                  error: result.error
              };
          }
      } catch (e) {
          return { id: 'database', label: 'Database Connection', status: 'error', message: 'Check failed', error: e.message };
      }
  }

  async checkConfigCache(projectPath) {
      const cachedConfig = path.join(projectPath, 'bootstrap/cache/config.php');
      const isCached = fs.existsSync(cachedConfig);
      
      // In dev, usually we DON'T want config cached to avoid confusion
      // But purely checking status here
      return {
          id: 'config_cache',
          label: 'Config Cache',
          status: 'info', // Info because it's state, not necessarily error
          message: isCached ? 'Cached (Configuration is frozen)' : 'Not cached (Dynamic)'
      };
  }
}

module.exports = new DoctorService();
