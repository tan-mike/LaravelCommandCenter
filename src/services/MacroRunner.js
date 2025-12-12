const ArtisanBridge = require('./ArtisanBridge');
const { exec } = require('child_process');
const { promisify } = require('util');
const db = require('../db/Database');

const execAsync = promisify(exec);

class MacroRunner {
  /**
   * Get available macros
   */
  static getMacros() {
    return [
      {
        id: 'clear-caches',
        name: 'Clear All Caches',
        description: 'Clear config, route, view, cache, and optimize caches',
        commands: [
          'config:clear',
          'route:clear',
          'view:clear',
          'cache:clear',
          'optimize:clear'
        ],
        destructive: false
      },
      {
        id: 'rebuild-autoload',
        name: 'Rebuild Autoload',
        description: 'Run composer dump-autoload',
        commands: ['composer dump-autoload'],
        destructive: false,
        usesComposer: true
      },
      {
        id: 'retry-failed-jobs',
        name: 'Retry Failed Jobs',
        description: 'Retry all failed queue jobs',
        commands: ['queue:retry all'],
        destructive: false
      },
      {
        id: 'cache-config',
        name: 'Cache Configuration',
        description: 'Cache config and routes for production',
        commands: [
          'config:cache',
          'route:cache',
          'view:cache'
        ],
        destructive: false
      }
    ];
  }

  /**
   * Get macro by ID
   */
  static getMacro(macroId) {
    return this.getMacros().find(m => m.id === macroId);
  }

  /**
   * Run a macro
   * @param {string} macroId - Macro identifier
   * @param {string} projectPath - Path to Laravel project
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  static async run(macroId, projectPath, options = {}) {
    const {
      dryRun = false,
      onProgress = null
    } = options;

    const macro = this.getMacro(macroId);
    if (!macro) {
      throw new Error(`Macro not found: ${macroId}`);
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        commands: macro.commands,
        message: 'Dry run - no commands executed'
      };
    }

    const results = [];
    let allSuccess = true;

    for (let i = 0; i < macro.commands.length; i++) {
      const command = macro.commands[i];
      
      if (onProgress) {
        onProgress({
          step: i + 1,
          total: macro.commands.length,
          command
        });
      }

      try {
        let result;
        
        if (macro.usesComposer) {
          // Execute composer command
          result = await this.executeComposerCommand(projectPath, command);
        } else {
          // Execute artisan command
          result = await ArtisanBridge.execute(projectPath, command);
        }

        results.push({
          command,
          success: result.success,
          output: result.output,
          error: result.error
        });

        if (!result.success) {
          allSuccess = false;
        }
      } catch (error) {
        results.push({
          command,
          success: false,
          output: '',
          error: error.message
        });
        allSuccess = false;
      }
    }

    // Log macro execution
    this.logMacroExecution(projectPath, macroId, allSuccess);

    return {
      success: allSuccess,
      dryRun: false,
      results,
      macro: macro.name
    };
  }

  /**
   * Execute composer command
   */
  static async executeComposerCommand(projectPath, command) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectPath,
        timeout: 60000 // Composer can be slow
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
   * Log macro execution to database
   */
  static logMacroExecution(projectPath, macroId, success) {
    try {
      const projectDb = db.get(
        'SELECT id FROM projects WHERE path = ?',
        [projectPath]
      );

      if (projectDb) {
        db.run(
          `INSERT INTO macros (project_id, name, last_run_at, run_count)
           VALUES (?, ?, datetime('now'), 1)
           ON CONFLICT(project_id, name) DO UPDATE SET
             last_run_at = datetime('now'),
             run_count = run_count + 1`,
          [projectDb.id, macroId]
        );
      }

      // Also log to audit trail
      this.logAudit(projectPath, 'macro_executed', {
        macro: macroId,
        success
      });
    } catch (error) {
      console.error('Failed to log macro execution:', error.message);
    }
  }

  /**
   * Log action to audit trail
   */
  static logAudit(projectPath, action, details) {
    try {
      const projectDb = db.get(
        'SELECT id FROM projects WHERE path = ?',
        [projectPath]
      );

      if (projectDb) {
        const actor = process.env.USER || process.env.USERNAME || 'unknown';
        
        db.run(
          `INSERT INTO audit_log (project_id, action, details, actor, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [projectDb.id, action, JSON.stringify(details), actor]
        );
      }
    } catch (error) {
      console.error('Failed to log audit entry:', error.message);
    }
  }
}

module.exports = MacroRunner;
