const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('api', {
  // Project operations
  scanProject: (projectPath) => ipcRenderer.invoke('scan-project', projectPath),
  getProjects: () => ipcRenderer.invoke('get-projects'),

  // Macro operations
  getMacros: () => ipcRenderer.invoke('get-macros'),
  runMacro: (macroId, projectPath, options) => ipcRenderer.invoke('run-macro', macroId, projectPath, options),

  // Artisan commands
  executeArtisan: (projectPath, command, options) => ipcRenderer.invoke('execute-artisan', projectPath, command, options),
  getRoutes: (projectPath) => ipcRenderer.invoke('get-routes', projectPath),
  getMigrationStatus: (projectPath) => ipcRenderer.invoke('get-migration-status', projectPath),
  getFailedJobs: (projectPath) => ipcRenderer.invoke('get-failed-jobs', projectPath),

  // Log intelligence
  logsStartTail: (projectId, logFilePath) => ipcRenderer.invoke('logs:start-tail', projectId, logFilePath),
  logsStopTail: (projectId) => ipcRenderer.invoke('logs:stop-tail', projectId),
  logsGetErrors: (projectId, options) => ipcRenderer.invoke('logs:get-errors', projectId, options),
  logsGetErrorDetail: (errorId) => ipcRenderer.invoke('logs:get-error-detail', errorId),
  logsUpdateStatus: (errorId, status) => ipcRenderer.invoke('logs:update-status', errorId, status),
  logsGetStats: (projectId) => ipcRenderer.invoke('logs:get-stats', projectId),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Routes
  routesGet: (projectPath) => ipcRenderer.invoke('routes:list', projectPath),

  // Doctor
  doctorCheck: (projectPath) => ipcRenderer.invoke('doctor:check', projectPath),

  // Models
  modelsAudit: (projectPath) => ipcRenderer.invoke('models:audit', projectPath),

  // Pulse (Monitoring)
  getPulseStats: (projectPath) => ipcRenderer.invoke('pulse:stats', projectPath),
  getPulseFpmDetails: () => ipcRenderer.invoke('pulse:fpm-details'),
  getPulseDbDetails: (projectPath) => ipcRenderer.invoke('pulse:db-details', projectPath),

  // Queue
  queueStatus: (projectId) => ipcRenderer.invoke('queue:status', projectId),
  queueControl: (projectId, action, projectPath) => ipcRenderer.invoke('queue:control', projectId, action, projectPath),
  queueFailedList: (projectPath) => ipcRenderer.invoke('queue:failed-list', projectPath),
  queueRetry: (projectPath, id) => ipcRenderer.invoke('queue:retry', projectPath, id),
  queueForget: (projectPath, id) => ipcRenderer.invoke('queue:forget', projectPath, id),
  queueFlush: (projectPath) => ipcRenderer.invoke('queue:flush', projectPath),

  // Database
  dbMigrations: (projectPath) => ipcRenderer.invoke('db:migrations', projectPath),
  dbMigrate: (projectPath) => ipcRenderer.invoke('db:migrate', projectPath),
  dbRollback: (projectPath, steps) => ipcRenderer.invoke('db:rollback', projectPath, steps),
  dbReset: (projectPath) => ipcRenderer.invoke('db:reset', projectPath),
  dbRefresh: (projectPath) => ipcRenderer.invoke('db:refresh', projectPath),
  dbEnv: (projectPath) => ipcRenderer.invoke('db:env', projectPath),

  // Events
  onLogUpdate: (callback) => ipcRenderer.on('log-entry', (event, entry) => callback(entry)),
  onQueueOutput: (callback) => {
    const listener = (event, output) => callback(output);
    ipcRenderer.on('queue:output', listener);
    return () => ipcRenderer.removeListener('queue:output', listener);
  },
  onErrorIndexed: (callback) => ipcRenderer.on('error-indexed', (event, result) => callback(result)),

  // Update events
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  installUpdate: () => ipcRenderer.send('install-update'),

  // File selection
  selectLogFile: () => ipcRenderer.invoke('select-log-file'),
  parseLogFile: (filePath) => ipcRenderer.invoke('parse-log-file', filePath),

  // Log Parser (SQLite Session)
  logsImport: (filePath) => ipcRenderer.invoke('logs:import', filePath),
  logsGetSessionStats: (sessionId) => ipcRenderer.invoke('logs:get-session-stats', sessionId),
  logsGetEntries: (sessionId, options) => ipcRenderer.invoke('logs:get-entries', sessionId, options)
});
