const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ArtisanBridge {
  /**
   * Execute an artisan command
   * @param {string} projectPath - Path to Laravel project
   * @param {string} command - Artisan command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   */
  static async execute(projectPath, command, options = {}) {
    const {
      timeout = 30000,
      interactive = false,
      onOutput = null
    } = options;

    if (interactive || onOutput) {
      return this.executeStreaming(projectPath, command, onOutput);
    }

    try {
      const fullCommand = `php artisan ${command}`;
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: projectPath,
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      return {
        success: true,
        output: stdout,
        error: stderr
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Execute command with streaming output
   */
  static executeStreaming(projectPath, command, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn('php', ['artisan', ...command.split(' ')], {
        cwd: projectPath,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (onOutput) {
          onOutput({ type: 'stdout', data: output });
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (onOutput) {
          onOutput({ type: 'stderr', data: output });
        }
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get artisan command list
   */
  static async listCommands(projectPath) {
    const result = await this.execute(projectPath, 'list --format=json');
    if (result.success) {
      try {
        return JSON.parse(result.output);
      } catch (error) {
        throw new Error('Failed to parse artisan list output');
      }
    }
    throw new Error(result.error);
  }

  /**
   * Get route list
   */
  static async getRoutes(projectPath) {
    const result = await this.execute(projectPath, 'route:list --json');
    if (result.success) {
      try {
        return JSON.parse(result.output);
      } catch (error) {
        // Fallback to text parsing if JSON not available
        return this.parseRoutesText(result.output);
      }
    }
    throw new Error(result.error);
  }

  /**
   * Parse route:list text output (fallback)
   */
  static parseRoutesText(output) {
    // Basic text parsing - to be improved
    const lines = output.split('\n');
    const routes = [];
    
    lines.forEach(line => {
      // Skip header and separator lines
      if (line.includes('---') || line.includes('Method') || !line.trim()) {
        return;
      }
      
      // Parse route line (basic implementation)
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 4) {
        routes.push({
          method: parts[0],
          uri: parts[1],
          name: parts[2] || null,
          action: parts[3]
        });
      }
    });
    
    return routes;
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(projectPath) {
    const result = await this.execute(projectPath, 'migrate:status');
    return result;
  }

  /**
   * Get failed queue jobs
   */
  static async getFailedJobs(projectPath) {
    const result = await this.execute(projectPath, 'queue:failed --format=json');
    if (result.success) {
      try {
        return JSON.parse(result.output);
      } catch (error) {
        return [];
      }
    }
    return [];
  }
}

module.exports = ArtisanBridge;
