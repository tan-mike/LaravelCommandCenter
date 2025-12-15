const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ArtisanBridge = require('./ArtisanBridge');
const QueueService = require('./QueueService');
const LogIndexer = require('./LogIndexer');
const DatabaseService = require('./DatabaseService');

class PulseService {
  async getStats(projectPath) {
    console.log('[Pulse] Collecting stats for', projectPath);
    try {
        const sysPromise = this.getSystemStats().catch(err => {
            console.error('[Pulse] System stats failed:', err);
            return null;
        });
        
        const appPromise = this.getAppStats(projectPath).catch(err => {
            console.error('[Pulse] App stats failed:', err);
            return {};
        });

        const [system, app] = await Promise.all([sysPromise, appPromise]);
        
        console.log('[Pulse] Stats collected:', { 
            hasSystem: !!system, 
            appKeys: app ? Object.keys(app) : [] 
        });

        return {
            system: system || { output: 'error' }, // Prevent undefined
            ...app
        };
    } catch (error) {
        console.error('[Pulse] Critical failure:', error);
        throw error;
    }
  }

  async getSystemStats() {
    try {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const uptime = os.uptime();
        const cpuPercent = cpus ? Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100)) : 0;

        return {
          cpu: cpuPercent,
          memory: {
            total: totalMem,
            free: freeMem,
            used: totalMem - freeMem,
            percent: totalMem ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0
          },
          uptime,
          load: loadAvg
        };
    } catch (e) {
        console.error('[Pulse] System stats error:', e);
        throw e;
    }
  }

  async getAppStats(projectPath) {
    // Use allSettled to prevent one failure from blocking others
    const results = await Promise.allSettled([
      this.getQueueStats(projectPath),
      this.getLogStats(projectPath),
      this.getDatabaseStats(projectPath),
      this.getPhpFpmStats()
    ]);

    const [queue, logs, database, phpFpm] = results.map(r => 
        r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Failed' }
    );

    return {
      queue,
      logs,
      database,
      phpFpm
    };
  }

  async getQueueStats(projectPath) {
    try {
      const failedJobs = await QueueService.getFailedJobs(projectPath);
      return {
        failed: failedJobs.length,
      };
    } catch (e) {
        return { failed: 0, error: e.message };
    }
  }

  async getLogStats(projectPath) {
    try {
        return { errors_past_hour: 0 };
    } catch (e) {
        return { error: e.message };
    }
  }
  
  async getDatabaseStats(projectPath) {
    const fs = require('fs');
    const path = require('path');
    console.log('[Pulse] Checking Database for:', projectPath);
    
    const scriptPath = path.join(projectPath, '_devctl_db_pulse.php');
    
    // PHP script to check DB connection and basic deadlock info
    const phpCode = `<?php
    define('LARAVEL_START', microtime(true));
    require __DIR__.'/vendor/autoload.php';
    $app = require_once __DIR__.'/bootstrap/app.php';
    $kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
    $kernel->bootstrap();

    try {
        $pdo = \\Illuminate\\Support\\Facades\\DB::connection()->getPdo();
        $driver = \\Illuminate\\Support\\Facades\\DB::connection()->getDriverName();
        
        $info = [
            'status' => 'connected',
            'driver' => $driver,
            'deadlocks' => 0
        ];

        if ($driver === 'mysql') {
            try {
                $status = \\Illuminate\\Support\\Facades\\DB::select("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'");
                if (!empty($status)) {
                    foreach ($status as $row) {
                         $val = is_object($row) ? $row->Value : $row['Value'];
                         $info['deadlocks'] = (int)$val;
                         break;
                    }
                }
            } catch (\\Throwable $t) {}
        }
        
        echo json_encode(['success' => true, 'data' => $info]);
    } catch (\\Throwable $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    `;

    try {
        const ConfigService = require('./ConfigService');
        const phpPath = ConfigService.get('php.path') || 'php';
        console.log('[Pulse] Using PHP path:', phpPath);
        
        fs.writeFileSync(scriptPath, phpCode);
        const { stdout, stderr } = await execAsync(`"${phpPath}" _devctl_db_pulse.php`, { 
            cwd: projectPath,
            timeout: 5000 
        });
        try { fs.unlinkSync(scriptPath); } catch(e) {}
        
        console.log('[Pulse] DB Script Output:', stdout);
        if (stderr) console.error('[Pulse] DB Script Stderr:', stderr);

        const jsonMatch = stdout.match(/\{.*\}/s);
        if (jsonMatch) {
             const result = JSON.parse(jsonMatch[0]);
             if (result.success) {
                 return result.data;
             }
             return { status: 'error', error: result.error || 'Unknown DB Error', deadlocks: 0 };
        }
        return { status: 'error', error: 'Invalid script output: ' + stdout.substring(0, 50), deadlocks: 0 };

    } catch (error) {
        console.error('[Pulse] DB Check Failed:', error);
        try { fs.unlinkSync(scriptPath); } catch(e) {}
        return { 
            status: 'error', 
            error: error.message, 
            deadlocks: 0 
        };
    }
  }

  async getPhpFpmStats() {
    // Improved check: case insensitive, handles full paths
    try {
        // Just count processes with 'php-fpm' in the name
        const cmd = 'ps -A | grep -i "php-fpm" | grep -v grep | wc -l';
        console.log('[Pulse] Running FPM check:', cmd);
        const { stdout } = await execAsync(cmd, { timeout: 2000 });
        console.log('[Pulse] FPM Result:', stdout);
        
        const count = parseInt(stdout.trim());
        
        return {
            running: count > 0,
            processes: count
        };
    } catch (e) {
        console.error('[Pulse] FPM Check Failed:', e);
        return { running: false, error: e.message };
    }
  }

  async getPhpFpmDetails() {
      try {
          // Get detailed process list
          // Format: user, pid, cpu, mem, time, command
          const cmd = 'ps -A -o user,pid,%cpu,%mem,time,command | grep -i "php-fpm" | grep -v grep | head -n 50';
          const { stdout } = await execAsync(cmd);
          
          const processes = stdout.trim().split('\n').map(line => {
              // Simple fixed-width or regex parsing might be needed as columns vary
              // But 'ps' output with -o is reasonably standard.
              // We'll normalize whitespace first
              const parts = line.trim().split(/\s+/);
              if (parts.length < 6) return null;
              
              return {
                  user: parts[0],
                  pid: parts[1],
                  cpu: parts[2],
                  memory: parts[3],
                  time: parts[4],
                  command: parts.slice(5).join(' ')
              };
          }).filter(p => p !== null && !p.command.includes('ps -A')); // Filter out the ps command itself if caught

          return processes;
      } catch (e) {
          throw new Error('Failed to get process list: ' + e.message);
      }
  }

  async getDatabaseDetails(projectPath) {
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(projectPath, '_devctl_db_details.php');
    
    const phpCode = `<?php
    define('LARAVEL_START', microtime(true));
    require __DIR__.'/vendor/autoload.php';
    $app = require_once __DIR__.'/bootstrap/app.php';
    $kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
    $kernel->bootstrap();

    $result = [
        'full_processlist' => [],
        'innodb_status' => null
    ];

    try {
        $pdo = \\Illuminate\\Support\\Facades\\DB::connection()->getPdo();
        $driver = \\Illuminate\\Support\\Facades\\DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            // Get Running queries (exclude Sleep)
            $processes = \\Illuminate\\Support\\Facades\\DB::select("SHOW FULL PROCESSLIST");
            $result['full_processlist'] = array_filter($processes, function($p) {
                return ($p->Command ?? $p->command) !== 'Sleep';
            });

            // Get Engine Status (for deadlocks)
            try {
                $status = \\Illuminate\\Support\\Facades\\DB::select("SHOW ENGINE INNODB STATUS");
                if (!empty($status)) {
                     foreach ($status as $row) {
                         $val = is_object($row) ? $row->Status : $row['Status'];
                         $result['innodb_status'] = $val;
                         break;
                    }
                }
            } catch (\\Throwable $t) {}
        }
    } catch (\\Throwable $e) {
        // Just return what we have
    }
    
    echo json_encode(['success' => true, 'data' => $result]);
    `;

    try {
        const ConfigService = require('./ConfigService');
        const phpPath = ConfigService.get('php.path') || 'php';
        
        fs.writeFileSync(scriptPath, phpCode);
        const { stdout } = await execAsync(`"${phpPath}" _devctl_db_details.php`, { 
            cwd: projectPath,
            timeout: 5000 
        });
        try { fs.unlinkSync(scriptPath); } catch(e) {}

        const jsonMatch = stdout.match(/\{.*\}/s);
        if (jsonMatch) {
             const res = JSON.parse(jsonMatch[0]);
             return res.success ? res.data : { error: res.error };
        }
        return { error: 'Invalid output' };

    } catch (error) {
        try { fs.unlinkSync(scriptPath); } catch(e) {}
        return { error: error.message };
    }
  }
}

module.exports = new PulseService();
