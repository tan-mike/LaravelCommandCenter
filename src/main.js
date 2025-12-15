const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const db = require('./db/Database');
const ProjectScanner = require('./services/ProjectScanner');
const ArtisanBridge = require('./services/ArtisanBridge');
const MacroRunner = require('./services/MacroRunner');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  // Load the app
  mainWindow.loadFile('src/renderer/index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Check for updates after window loads
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });
}

app.whenReady().then(() => {
  // Initialize database
  db.initialize();
  
  createWindow();
  setupAutoUpdater();
  setupIPC();
  registerDeepLinks();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Close database connection
  db.close();
});

function setupAutoUpdater() {
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });
}

function setupIPC() {
  // Project scanning
  ipcMain.handle('scan-project', async (event, projectPath) => {
    try {
      const projectInfo = await ProjectScanner.scan(projectPath);
      
      // Save to database
      db.run(
        `INSERT INTO projects (path, name, last_scan_at, config)
         VALUES (?, ?, datetime('now'), ?)
         ON CONFLICT(path) DO UPDATE SET
           name = excluded.name,
           last_scan_at = datetime('now'),
           config = excluded.config`,
        [projectInfo.path, projectInfo.name, JSON.stringify(projectInfo)]
      );
      
      return { success: true, data: projectInfo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get saved projects
  ipcMain.handle('get-projects', async () => {
    try {
      const projects = db.all('SELECT * FROM projects ORDER BY last_scan_at DESC');
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Run macro
  ipcMain.handle('run-macro', async (event, macroId, projectPath, options) => {
    try {
      const result = await MacroRunner.run(macroId, projectPath, options);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get available macros
  ipcMain.handle('get-macros', async () => {
    try {
      const macros = MacroRunner.getMacros();
      return { success: true, data: macros };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Execute artisan command
  ipcMain.handle('execute-artisan', async (event, projectPath, command, options) => {
    try {
      const result = await ArtisanBridge.execute(projectPath, command, options);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get routes
  ipcMain.handle('get-routes', async (event, projectPath) => {
    try {
      const routes = await ArtisanBridge.getRoutes(projectPath);
      return { success: true, data: routes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get migration status
  ipcMain.handle('get-migration-status', async (event, projectPath) => {
    try {
      const status = await ArtisanBridge.getMigrationStatus(projectPath);
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get failed jobs
  ipcMain.handle('get-failed-jobs', async (event, projectPath) => {
    try {
      const jobs = await ArtisanBridge.getFailedJobs(projectPath);
      return { success: true, data: jobs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Log intelligence
  const LogTailer = require('./services/LogTailer');
  const LogIndexer = require('./services/LogIndexer');
  const LogParser = require('./services/LogParser');
  const configService = require('./services/ConfigService');
  const routeService = require('./services/RouteService');
  const doctorService = require('./services/DoctorService');
  const modelService = require('./services/ModelService');
  const queueService = require('./services/QueueService');
  const databaseService = require('./services/DatabaseService'); // Added
  const activeTailers = new Map();


  ipcMain.handle('logs:start-tail', async (event, projectId, logFilePath) => {
    try {
      // Stop existing tailer if any
      if (activeTailers.has(projectId)) {
        activeTailers.get(projectId).stop();
      }

      const tailer = new LogTailer(projectId, logFilePath);
      
      // Forward events to renderer
      tailer.on('entry', (entry) => {
        mainWindow.webContents.send('log-entry', entry);
      });

      tailer.on('error-indexed', (result) => {
        mainWindow.webContents.send('error-indexed', result);
      });

      await tailer.start();
      activeTailers.set(projectId, tailer);

      return { success: true, message: 'Log tailing started' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:stop-tail', async (event, projectId) => {
    try {
      if (activeTailers.has(projectId)) {
        activeTailers.get(projectId).stop();
        activeTailers.delete(projectId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:get-errors', async (event, projectId, options) => {
    try {
      const errors = LogIndexer.getGroupedErrors(projectId, options);
      return { success: true, data: errors };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:get-error-detail', async (event, errorId) => {
    try {
      const error = LogIndexer.getErrorDetail(errorId);
      return { success: true, data: error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:update-status', async (event, errorId, status) => {
    try {
      LogIndexer.updateErrorStatus(errorId, status);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:get-stats', async (event, projectId) => {
    try {
      const stats = LogIndexer.getStats(projectId);
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // File selection for logs
  ipcMain.handle('select-log-file', async (event) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Log File',
        filters: [
          { name: 'Log Files', extensions: ['log'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Parse entire log file for static analysis
  ipcMain.handle('parse-log-file', async (event, filePath) => {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      // Read file content (Limit to last 10MB to prevent crashes)
      const fileStats = fs.statSync(filePath);
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      let content;

      if (fileStats.size > MAX_SIZE) {
        const buffer = Buffer.alloc(MAX_SIZE);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, MAX_SIZE, fileStats.size - MAX_SIZE);
        fs.closeSync(fd);
        content = buffer.toString('utf8');
        // Discard first partial line
        const headerIndex = content.indexOf('\n');
        if (headerIndex !== -1) {
            content = content.substring(headerIndex + 1);
        }
      } else {
        content = fs.readFileSync(filePath, 'utf8');
      }
      
      // Parse with LogParser
      const entries = LogParser.parse(content);

      // Group entries by level and fingerprint
      const logGroups = {};
      const stats = {
        total: entries.length,
        errors: 0,
        warnings: 0,
        info: 0,
        debug: 0
      };

      entries.forEach(entry => {
        // Update stats
        const level = entry.level.toUpperCase();
        if (level === 'ERROR' || level === 'CRITICAL' || level === 'EMERGENCY') {
          stats.errors++;
        } else if (level === 'WARNING') {
          stats.warnings++;
        } else if (level === 'INFO') {
          stats.info++;
        } else if (level === 'DEBUG') {
          stats.debug++;
        }

        // Group all entries by fingerprint
        if (!logGroups[entry.fingerprint]) {
          logGroups[entry.fingerprint] = {
            fingerprint: entry.fingerprint,
            title: entry.title,
            exception: entry.exception,
            level: entry.level,
            count: 0,
            firstSeen: entry.timestamp,
            lastSeen: entry.timestamp,
            entries: []
          };
        }
        logGroups[entry.fingerprint].count++;
        logGroups[entry.fingerprint].lastSeen = entry.timestamp;
        logGroups[entry.fingerprint].entries.push(entry);
      });

      // Convert to array and sort by count
      const groupedLogs = Object.values(logGroups)
        .sort((a, b) => b.count - a.count);

      return {
        success: true,
        data: {
          stats,
          entries,
          groupedLogs
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return configService.getAll();
  });

  ipcMain.handle('settings:set', async (event, key, value) => {
    return configService.set(key, value);
  });

  // Routes
  ipcMain.handle('routes:list', async (event, projectPath) => {
    try {
      const routes = await routeService.getRoutes(projectPath);
      return { success: true, data: routes };
    } catch (e) { 
      return { success: false, error: e.message };
    }
  });

  // Doctor
  ipcMain.handle('doctor:check', async (event, projectPath) => {
    try {
      const checks = await doctorService.runChecks(projectPath);
      return { success: true, data: checks };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Models
  ipcMain.handle('models:audit', async (event, projectPath) => {
    try {
      const data = await modelService.runAudit(projectPath);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Pulse (Monitoring)
  const PulseService = require('./services/PulseService');
  ipcMain.handle('pulse:stats', async (event, projectPath) => {
    try {
      console.log('[Main] IPC pulse:stats called for', projectPath);
      const stats = await PulseService.getStats(projectPath);
      console.log('[Main] PulseService returned:', JSON.stringify(stats));
      return { success: true, data: stats };
    } catch (e) {
      console.error('[Main] PulseService error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('pulse:fpm-details', async () => {
      try {
          const data = await PulseService.getPhpFpmDetails();
          return { success: true, data };
      } catch (e) {
          return { success: false, error: e.message };
      }
  });

  ipcMain.handle('pulse:db-details', async (event, projectPath) => {
      try {
          const data = await PulseService.getDatabaseDetails(projectPath);
          return { success: true, data };
      } catch (e) {
          return { success: false, error: e.message };
      }
  });



  // Queue
  ipcMain.handle('queue:status', (event, projectId) => {
    return { status: queueService.getWorkerStatus(projectId) };
  });

  ipcMain.handle('queue:control', (event, projectId, action, projectPath) => {
    if (action === 'start') {
      return queueService.startWorker(projectId, projectPath, (output) => {
        mainWindow.webContents.send('queue:output', output);
      });
    } else {
      return queueService.stopWorker(projectId);
    }
  });

  ipcMain.handle('queue:failed-list', async (event, projectPath) => {
    try {
      const data = await queueService.getFailedJobs(projectPath);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('queue:retry', async (event, projectPath, id) => {
    return queueService.retryJob(projectPath, id);
  });

  ipcMain.handle('queue:forget', async (event, projectPath, id) => {
    return queueService.forgetJob(projectPath, id);
  });

  ipcMain.handle('queue:flush', async (event, projectPath) => {
    return queueService.flushFailed(projectPath);
  });

  // Database
  ipcMain.handle('db:migrations', async (event, projectPath) => {
    try {
        const data = await databaseService.getMigrations(projectPath);
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:migrate', async (event, projectPath) => {
    return databaseService.runMigrate(projectPath);
  });

  ipcMain.handle('db:rollback', async (event, projectPath, steps) => {
    return databaseService.rollback(projectPath, steps);
  });

  ipcMain.handle('db:reset', async (event, projectPath) => {
    return databaseService.reset(projectPath);
  });

  ipcMain.handle('db:refresh', async (event, projectPath) => {
    return databaseService.refresh(projectPath);
  });

  ipcMain.handle('db:env', async (event, projectPath) => {
    return databaseService.getEnvironment(projectPath);
  });

  // Log Parser (SQLite Session)
  const logSessionService = require('./services/LogSessionService');

  ipcMain.handle('logs:import', async (event, filePath) => {
    try {
        return await logSessionService.importLog(filePath);
    } catch (e) {
        return { success: false, error: e.message };
    }
  });

  ipcMain.handle('logs:get-session-stats', async (event, sessionId) => {
    try {
        const data = logSessionService.getSessionStats(sessionId);
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
  });

  ipcMain.handle('logs:get-entries', async (event, sessionId, options) => {
    try {
        const result = logSessionService.getEntries(sessionId, options);
        return { success: true, ...result };
    } catch (e) {
        return { success: false, error: e.message };
    }
  });

  registerDeepLinks();
}

function registerDeepLinks() {
  // Register protocol handler for custom URLs
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('devctl', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('devctl');
  }
}
