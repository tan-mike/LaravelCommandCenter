import React, { useState, useEffect } from 'react';

function LogsView({ currentProject }) {
  const [errors, setErrors] = useState([]);
  const [selectedError, setSelectedError] = useState(null);
  const [stats, setStats] = useState(null);
  const [isTailing, setIsTailing] = useState(false);
  const [liveEntries, setLiveEntries] = useState([]);
  const [selectedLogPath, setSelectedLogPath] = useState('storage/logs/laravel.log');
  const [isDragging, setIsDragging] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('live-tail');
  
  // Log Parser tab state
  const [parserLogPath, setParserLogPath] = useState('');
  const [parserIsDragging, setParserIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [filterLevel, setFilterLevel] = useState('all'); // 'all', 'errors', 'warnings', 'info', 'debug'
  const [selectedGroup, setSelectedGroup] = useState(null); // Selected log group to view entries
  const [searchKeyword, setSearchKeyword] = useState(''); // Keyword filter for grouped logs
  const [settings, setSettings] = useState({ editor: { app: 'vscode' } });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const config = await window.api.getSettings();
      if (config) setSettings(config);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleFrameClick = (frame) => {
    if (!frame || !frame.file) return;

    let url = '';
    const { app, customPath } = settings.editor || {};
    const filePath = frame.file;
    const line = frame.line || 1;

    if (app === 'vscode') {
      url = `vscode://file/${filePath}:${line}`;
    } else if (app === 'phpstorm') {
      url = `phpstorm://open?file=${filePath}&line=${line}`;
    } else if (app === 'sublime') {
      url = `subl://${filePath}:${line}`;
    } else if (app === 'atom') {
      url = `atom://core/open/file?filename=${filePath}&line=${line}`;
    } else if (app === 'custom' && customPath) {
      url = customPath
        .replace('%file', filePath)
        .replace('%line', line);
    } else if (app === 'antigravity') {
        const context = {
            file: filePath,
            line: line
        };
        const encoded = btoa(JSON.stringify(context));
        url = `antigravity://open?context=${encoded}`;
    }

    if (url) {
      window.location.href = url;
    }
  };

  const handleAskAntigravity = (errorOrEntry) => {
    const context = {
      title: errorOrEntry.title || 'Log Entry',
      message: errorOrEntry.message,
      file: errorOrEntry.sample_trace?.[0]?.file || errorOrEntry.file,
      line: errorOrEntry.sample_trace?.[0]?.line || errorOrEntry.line,
      stack: errorOrEntry.sample_trace || errorOrEntry.stackTrace
    };

    const json = JSON.stringify(context);
    const encoded = btoa(json);
    const url = `antigravity://open?context=${encoded}`;

    // Also copy to clipboard as fallback
    navigator.clipboard.writeText(`Context for Antigravity:\n\`\`\`json\n${json}\n\`\`\``);
    alert('Context copied to clipboard!');
    
    // Attempt deep link
    window.location.href = url;
  };

  useEffect(() => {
    if (currentProject) {
      loadErrors();
      loadStats();
    }

    return () => {
      if (isTailing && currentProject) {
        stopTailing();
      }
    };
  }, [currentProject]);

  const loadErrors = async () => {
    if (!currentProject?.id) return;

    try {
      const result = await window.api.logsGetErrors(currentProject.id, {
        status: null,
        limit: 100,
        offset: 0
      });

      if (result.success) {
        setErrors(result.data);
      }
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  };

  const loadStats = async () => {
    if (!currentProject?.id) return;

    try {
      const result = await window.api.logsGetStats(currentProject.id);
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await window.api.selectLogFile();
      console.log('File picker result:', result);
      if (result.success && result.filePath) {
        setSelectedLogPath(result.filePath);
        console.log('Log path updated to:', result.filePath);
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    console.log('Files dropped:', files.length);
    if (files.length > 0) {
      const file = files[0];
      console.log('File:', file.name, file.path);
      if (file.name.endsWith('.log')) {
        setSelectedLogPath(file.path);
        console.log('Log path updated to:', file.path);
      } else {
        alert('Please drop a .log file');
      }
    }
  };

  const startTailing = async () => {
    if (!currentProject) return;

    // Use selected path, or default if it's relative
    let logPath = selectedLogPath;
    if (!selectedLogPath.includes('/') && !selectedLogPath.includes('\\')) {
      // Relative path, prepend project path
      logPath = `${currentProject.path}/${selectedLogPath}`.replace(/\\/g, '/');
    }

    try {
      const result = await window.api.logsStartTail(currentProject.id, logPath);

      if (result.success) {
        setIsTailing(true);

        // Listen for live entries
        window.api.onLogEntry((entry) => {
          setLiveEntries(prev => [...prev.slice(-99), entry]);
        });

        window.api.onErrorIndexed((result) => {
          // Refresh error list when new error is indexed
          loadErrors();
          loadStats();
        });
      }
    } catch (error) {
      console.error('Failed to start tailing:', error);
    }
  };

  const stopTailing = async () => {
    if (!currentProject) return;

    try {
      await window.api.logsStopTail(currentProject.id);
      setIsTailing(false);
      setLiveEntries([]);
    } catch (error) {
      console.error('Failed to stop tailing:', error);
    }
  };

  const handleErrorClick = async (error) => {
    try {
      const result = await window.api.logsGetErrorDetail(error.id);
      if (result.success) {
        setSelectedError(result.data);
      }
    } catch (error) {
      console.error('Failed to load error detail:', error);
    }
  };

  const handleUpdateStatus = async (errorId, status) => {
    try {
      await window.api.logsUpdateStatus(errorId, status);
      loadErrors();
      if (selectedError?.id === errorId) {
        setSelectedError({ ...selectedError, status });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Log Parser tab handlers
  const handleParserSelectFile = async () => {
    try {
      const result = await window.api.selectLogFile();
      console.log('Parser file picker result:', result);
      if (result.success && result.filePath) {
        setParserLogPath(result.filePath);
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  const handleParserDragOver = (e) => {
    e.preventDefault();
    setParserIsDragging(true);
  };

  const handleParserDragLeave = () => {
    setParserIsDragging(false);
  };

  const handleParserDrop = (e) => {
    e.preventDefault();
    setParserIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.log')) {
        setParserLogPath(file.path);
      } else {
        alert('Please drop a .log file');
      }
    }
  };

  const handleParseLog = async () => {
    if (!parserLogPath) {
      alert('Please select a log file first');
      return;
    }

    setParsing(true);
    try {
      const result = await window.api.parseLogFile(parserLogPath);
      console.log('Parse result:', result);
      if (result.success) {
        setParsedData(result.data);
      } else {
        alert(`Failed to parse log: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to parse log:', error);
      alert(`Error: ${error.message}`);
    }
    setParsing(false);
  };

  if (!currentProject) {
    return (
      <div className="card">
        <h2>Logs</h2>
        <p>Please select a project to view logs.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('live-tail')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'live-tail' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            background: activeTab === 'live-tail' ? 'var(--bg-tertiary)' : 'transparent',
            color: activeTab === 'live-tail' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Live Tail
        </button>
        <button
          onClick={() => setActiveTab('parser')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'parser' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            background: activeTab === 'parser' ? 'var(--bg-tertiary)' : 'transparent',
            color: activeTab === 'parser' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Log Parser
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'live-tail' && (
        <LiveTailTab
          currentProject={currentProject}
          selectedLogPath={selectedLogPath}
          setSelectedLogPath={setSelectedLogPath}
          isDragging={isDragging}
          handleSelectFile={handleSelectFile}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          isTailing={isTailing}
          startTailing={startTailing}
          stopTailing={stopTailing}
          loadErrors={loadErrors}
          stats={stats}
          errors={errors}
          selectedError={selectedError}
          handleErrorClick={handleErrorClick}
          handleUpdateStatus={handleUpdateStatus}
          liveEntries={liveEntries}
          settings={settings}
          handleFrameClick={handleFrameClick}
          handleAskAntigravity={handleAskAntigravity}
        />
      )}

      {activeTab === 'parser' && (
        <LogParserTab
          parserLogPath={parserLogPath}
          setParserLogPath={setParserLogPath}
          parserIsDragging={parserIsDragging}
          handleParserSelectFile={handleParserSelectFile}
          handleParserDragOver={handleParserDragOver}
          handleParserDragLeave={handleParserDragLeave}
          handleParserDrop={handleParserDrop}
          settings={settings}
          handleFrameClick={handleFrameClick}
          handleAskAntigravity={handleAskAntigravity}
        />
      )}
    </div>
  );
}

// Live Tail Tab Component
function LiveTailTab({
  currentProject,
  selectedLogPath,
  setSelectedLogPath,
  isDragging,
  handleSelectFile,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  isTailing,
  startTailing,
  stopTailing,
  loadErrors,
  stats,
  errors,
  selectedError,
  handleErrorClick,
  handleUpdateStatus,
  liveEntries,
  settings,
  handleFrameClick,
  handleAskAntigravity
}) {
  return (
    <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
      {/* Left panel - Error list */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
        <div className="card" style={{ marginBottom: '10px' }}>
          <div className="card-header">
            <h2>Log Intelligence</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadErrors}>Refresh</button>
              {isTailing ? (
                <button onClick={stopTailing} className="danger">Stop Tail</button>
              ) : (
                <button onClick={startTailing} className="primary">Start Tail</button>
              )}
            </div>
          </div>
          <div 
            className="card-content" 
            style={{
              padding: '12px',
              border: isDragging ? '2px dashed var(--accent-blue)' : '2px dashed var(--border-color)',
              borderRadius: '4px',
              marginBottom: '12px',
              backgroundColor: isDragging ? 'var(--bg-tertiary)' : 'transparent',
              transition: 'all 0.2s'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong>Log File:</strong>
              <input 
                type="text" 
                value={selectedLogPath} 
                onChange={(e) => setSelectedLogPath(e.target.value)}
                placeholder="storage/logs/laravel.log"
                style={{ flex: 1, fontSize: '12px' }}
                disabled={isTailing}
              />
              <button onClick={handleSelectFile} disabled={isTailing}>
                Browse...
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isDragging ? 'Drop log file here...' : 'Drag & drop a .log file or browse'}
            </div>
          </div>
          {stats && (
            <div className="card-content">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <strong>Total Errors:</strong> {stats.total_errors || 0}
                </div>
                <div>
                  <strong>Open:</strong> <span className="badge error">{stats.open_errors || 0}</span>
                </div>
                <div>
                  <strong>Occurrences:</strong> {stats.total_occurrences || 0}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3>Grouped Errors</h3>
          </div>
          <div style={{ flex: '1', overflowY: 'auto' }}>
            {errors.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No errors found
              </div>
            ) : (
              errors.map(error => (
                <div
                  key={error.id}
                  onClick={() => handleErrorClick(error)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    background: selectedError?.id === error.id ? 'var(--bg-tertiary)' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedError?.id === error.id ? 'var(--bg-tertiary)' : 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong>{error.title}</strong>
                    <span className={`badge ${error.status === 'open' ? 'error' : 'success'}`}>
                      {error.count}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Last seen: {new Date(error.last_seen).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {isTailing && (
          <div className="card" style={{ maxHeight: '200px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Live Tail</h3>
            </div>
            <div className="output-console" style={{ flex: '1' }}>
              {liveEntries.map((entry, index) => (
                <div key={index} className={`line ${entry.level.toLowerCase()}`}>
                  [{entry.timestamp.toLocaleTimeString()}] {entry.level}: {entry.message.substring(0, 100)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right panel - Error detail */}
      <div style={{ width: '500px', display: 'flex', flexDirection: 'column' }}>
        {selectedError ? (
          <div className="card" style={{ flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Error Detail</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleAskAntigravity(selectedError)}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-purple)', border: '1px solid var(--accent-purple)' }}
                >
                  Ask Antigravity
                </button>
                {selectedError.status === 'open' && (
                  <button onClick={() => handleUpdateStatus(selectedError.id, 'resolved')} className="primary">
                    Resolve
                  </button>
                )}
                {selectedError.status === 'resolved' && (
                  <button onClick={() => handleUpdateStatus(selectedError.id, 'open')}>
                    Reopen
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: '1', overflowY: 'auto', padding: '16px' }}>
              <h4>{selectedError.title}</h4>
              <div style={{ marginTop: '12px' }}>
                <strong>Count:</strong> {selectedError.count} occurrences
              </div>
              <div>
                <strong>First seen:</strong> {new Date(selectedError.first_seen).toLocaleString()}
              </div>
              <div>
                <strong>Last seen:</strong> {new Date(selectedError.last_seen).toLocaleString()}
              </div>
              <div>
                <strong>Status:</strong> <span className={`badge ${selectedError.status === 'open' ? 'error' : 'success'}`}>
                  {selectedError.status}
                </span>
              </div>

              <h4 style={{ marginTop: '20px' }}>Message</h4>
              <div className="output-console" style={{ marginTop: '8px' }}>
                {selectedError.message}
              </div>

              {selectedError.sample_trace && selectedError.sample_trace.length > 0 && (
                <>
                  <h4 style={{ marginTop: '20px' }}>Stack Trace</h4>
                  <div className="output-console" style={{ marginTop: '8px' }}>
                    {selectedError.sample_trace.map((frame, index) => (
                      <div key={index} style={{ marginBottom: '8px' }}>
                        <div 
                          style={{ color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => handleFrameClick(frame)}
                          title={`Open in ${settings.editor?.app || 'editor'}`}
                        >
                          #{index} {frame.file}:{frame.line}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                          {frame.call}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <p>Select an error to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Log Parser Tab Component
function LogParserTab({
  parserLogPath,
  setParserLogPath,
  parserIsDragging,
  handleParserSelectFile,
  handleParserDragOver,
  handleParserDragLeave,
  handleParserDrop,
  settings,
  handleFrameClick,
  handleAskAntigravity
}) {
  // Session state
  const [sessionId, setSessionId] = React.useState(null);
  const [importing, setImporting] = React.useState(false);
  const [sessionStats, setSessionStats] = React.useState(null);
  const [entries, setEntries] = React.useState([]);
  
  // Pagination & Filtering
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filterLevel, setFilterLevel] = React.useState('all');
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const [isLoadingEntries, setIsLoadingEntries] = React.useState(false);

  // Import Log
  const handleImportLog = async () => {
    if (!parserLogPath) {
      alert('Please select a log file first');
      return;
    }

    setImporting(true);
    setSessionId(null);
    setSessionStats(null);
    setEntries([]);
    setPage(1);

    try {
      const result = await window.api.logsImport(parserLogPath);
      if (result.success) {
        setSessionId(result.sessionId);
        loadSessionStats(result.sessionId);
        loadEntries(result.sessionId, 1, filterLevel, searchKeyword);
      } else {
        alert(`Failed to import log: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to import log:', error);
      alert(`Error: ${error.message}`);
    }
    setImporting(false);
  };

  const loadSessionStats = async (sid) => {
    try {
      const result = await window.api.logsGetSessionStats(sid);
      if (result.success) {
        setSessionStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadEntries = async (sid, pageNum, level, keyword) => {
    if (!sid) return;
    setIsLoadingEntries(true);
    try {
        const options = {
            page: pageNum,
            limit: 50,
            search: keyword
        };
        if (level !== 'all') {
            options.level = level;
        }

        const result = await window.api.logsGetEntries(sid, options);
        if (result.success) {
            setEntries(result.data);
            setPage(result.meta.page);
            setTotalPages(result.meta.last_page || 1);
        }
    } catch (error) {
        console.error('Failed to load entries:', error);
    }
    setIsLoadingEntries(false);
  };

  // Effects for filtering/pagination
  React.useEffect(() => {
    if (sessionId) {
        loadEntries(sessionId, 1, filterLevel, searchKeyword);
    }
  }, [filterLevel, searchKeyword]); // Reset to page 1 on filter change

  const handlePageChange = (newPage) => {
    if (sessionId && newPage >= 1 && newPage <= totalPages) {
        loadEntries(sessionId, newPage, filterLevel, searchKeyword);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
      {/* File Selection */}
      <div className="card">
        <div className="card-header">
          <h2>Log File Parser (SQLite Powered)</h2>
        </div>
        <div
          className="card-content"
          style={{
            padding: '12px',
            border: parserIsDragging ? '2px dashed var(--accent-blue)' : '2px dashed var(--border-color)',
            borderRadius: '4px',
            backgroundColor: parserIsDragging ? 'var(--bg-tertiary)' : 'transparent',
            transition: 'all 0.2s'
          }}
          onDragOver={handleParserDragOver}
          onDragLeave={handleParserDragLeave}
          onDrop={handleParserDrop}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <strong>Select Log File:</strong>
            <input
              type="text"
              value={parserLogPath}
              onChange={(e) => setParserLogPath(e.target.value)}
              placeholder="Path to log file"
              style={{ flex: 1, fontSize: '12px' }}
              disabled={importing}
            />
            <button onClick={handleParserSelectFile} disabled={importing}>
              Browse...
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {parserIsDragging ? 'Drop log file here...' : 'Drag & drop a .log file or browse'}
          </div>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button onClick={handleImportLog} className="primary" disabled={!parserLogPath || importing}>
            {importing ? 'Importing & Indexing...' : 'Parse Log File'}
          </button>
        </div>
      </div>

      {sessionStats && (
        <>
          {/* Statistics */}
          <div className="card">
            <div className="card-header">
              <h3>Statistics</h3>
            </div>
            <div className="card-content">
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterLevel('all')}
                  style={{
                    padding: '8px 16px',
                    background: filterLevel === 'all' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                    color: filterLevel === 'all' ? '#000' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <strong>All:</strong> {sessionStats.total}
                </button>
                <button
                  onClick={() => setFilterLevel('errors')}
                  style={{
                    padding: '8px 16px',
                    background: filterLevel === 'errors' ? 'var(--accent-red)' : 'var(--bg-tertiary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <strong>Errors:</strong> {sessionStats.errors}
                </button>
                <button
                  onClick={() => setFilterLevel('warnings')}
                  style={{
                    padding: '8px 16px',
                    background: filterLevel === 'warnings' ? 'var(--accent-yellow)' : 'var(--bg-tertiary)',
                    color: filterLevel === 'warnings' ? '#000' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <strong>Warnings:</strong> {sessionStats.warnings}
                </button>
                <button
                  onClick={() => setFilterLevel('info')}
                  style={{
                    padding: '8px 16px',
                    background: filterLevel === 'info' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                    color: filterLevel === 'info' ? '#000' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <strong>Info:</strong> {sessionStats.info}
                </button>
                <button
                  onClick={() => setFilterLevel('debug')}
                  style={{
                    padding: '8px 16px',
                    background: filterLevel === 'debug' ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    color: filterLevel === 'debug' ? '#000' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <strong>Debug:</strong> {sessionStats.debug}
                </button>
              </div>
            </div>
          </div>

          {/* Log Entries */}
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Logs {filterLevel !== 'all' && `(${filterLevel})`}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{ width: '200px', fontSize: '12px' }}
                />
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {isLoadingEntries ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : entries.length === 0 ? (
                     <div style={{ padding: '20px', textAlign: 'center' }}>No logs found matching criteria</div>
                ) : (
                    entries.map(entry => (
                        <div key={entry.id} className={`log-entry ${entry.level.toLowerCase()}`} style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                 <strong>[{new Date(entry.timestamp).toLocaleTimeString()}] {entry.level}</strong>
                                 <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Line {entry.line_number}</span>
                             </div>
                             <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>
                                 {entry.message}
                             </div>
                             {entry.context?.stackTrace && entry.context.stackTrace.length > 0 && ((
                                <div style={{ marginTop: '8px', paddingLeft: '10px', borderLeft: '2px solid var(--accent-red)' }}>
                                    {entry.context.stackTrace.slice(0, 3).map((frame, i) => (
                                        <div key={i} onClick={() => handleFrameClick(frame)} style={{ cursor: 'pointer', color: 'var(--accent-blue)' }}>
                                            {frame.file}:{frame.line}
                                        </div>
                                    ))}
                                    {entry.context.stackTrace.length > 3 && <div>...</div>}
                                </div>
                             ) || null)}
                             <div style={{ marginTop: '8px' }}>
                                <button 
                                  onClick={() => handleAskAntigravity(entry)}
                                  style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', border: '1px solid var(--accent-purple)', color: 'var(--accent-purple)' }}
                                >
                                  Ask Antigravity
                                </button>
                             </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Pagination Controls */}
            <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LogsView;
