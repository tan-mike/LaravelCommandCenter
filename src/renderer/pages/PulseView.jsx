import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ... (imports remain)

const DetailsModal = ({ title, onClose, children, loading }) => {
    if (!title) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-secondary, #fff)', 
                width: '800px', maxWidth: '90%', maxHeight: '80vh',
                borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }} onClick={e => e.stopPropagation()}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
                    <h3 style={{margin: 0}}>{title}</h3>
                    <button onClick={onClose} style={{border: 'none', background: 'transparent', fontSize: '1.2em', cursor: 'pointer'}}>×</button>
                </div>
                <div style={{overflowY: 'auto', flex: 1}}>
                    {loading ? <div className="spinner" style={{margin: '20px auto'}}></div> : children}
                </div>
            </div>
        </div>
    );
};

function PulseView({ currentProject }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Polling State
  const [isPolling, setIsPolling] = useState(true);
  const [pollInterval, setPollInterval] = useState(3000);

  console.log('[PulseView] Render. Project:', currentProject?.path, 'Loading:', loading, 'Stats:', !!stats, 'Error:', error);

  // Modal State
  const [modalType, setModalType] = useState(null); // 'fpm' | 'db'
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const pollIntervalRef = useRef(null);

  const fetchStats = async () => {
      // ... (existing fetchStats implementation)
      if (!currentProject) return;
      try {
        const result = await window.api.getPulseStats(currentProject.path);
        if (result.success) {
          setStats(result.data);
          setError(null);
          setLastUpdated(new Date());
        } else {
          console.error('Pulse check failed:', result.error);
          setError(result.error || 'Unknown IPC Error');
        }
      } catch (err) {
        console.error('Pulse fetch error:', err);
        setError('IPC Error: ' + (err.message || err.toString()));
      } finally {
        setLoading(false);
      }
  };

  const handleOpenFpmDetails = async () => {
      setModalType('fpm');
      setModalLoading(true);
      try {
          const res = await window.api.getPulseFpmDetails();
          if (res.success) setModalData(res.data);
          else setModalData({ error: res.error });
      } catch (e) { setModalData({ error: e.message }); }
      setModalLoading(false);
  };

  const handleOpenDbDetails = async () => {
      setModalType('db');
      setModalLoading(true);
      if (currentProject) {
        try {
            const res = await window.api.getPulseDbDetails(currentProject.path);
            if (res.success) setModalData(res.data);
            else setModalData({ error: res.error });
        } catch (e) { setModalData({ error: e.message }); }
      }
      setModalLoading(false);
  };

  const closeModal = () => {
      setModalType(null);
      setModalData(null);
  };

  // ... (useEffect remains same)
    useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    fetchStats(); // Initial fetch

    if (isPolling) {
        pollIntervalRef.current = setInterval(fetchStats, pollInterval);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentProject, isPolling, pollInterval]);

  if (!currentProject) {
    return (
      <div className="pulse-container empty-state">
        <h2>No Project Selected</h2>
        <p>Please select a project to view Pulse monitoring.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="pulse-container loading-state">
        <div className="spinner"></div>
        <p>Connecting to Pulse...</p>
      </div>
    );
  }

  if (!stats && error) {
      return (
        <div className="pulse-container error-state" style={{padding: '20px', textAlign: 'center'}}>
            <h2 style={{color: '#ef4444'}}>Pulse Connection Failed</h2>
            <p style={{background: '#fee2e2', padding: '10px', display: 'inline-block', borderRadius: '4px', fontFamily: 'monospace'}}>
                {error}
            </p>
            <p>
                <button onClick={fetchStats} style={{padding: '8px 16px', cursor: 'pointer'}}>Retry</button>
            </p>
        </div>
      );
  }

  return (
    <div className="pulse-view">
      {/* ... Header ... */}
      <header className="pulse-header">
        <div className="header-left">
          <h1>Pulse</h1>
          <span className="live-indicator">
            <span className="pulse-dot" style={{animationDuration: isPolling ? '2s' : '0s', background: isPolling ? '#10b981' : '#ccc'}}></span> 
            {isPolling ? 'Live' : 'Paused'}
          </span>
          <small style={{marginLeft: '15px', color: '#999', fontFamily: 'monospace'}}>
            {currentProject?.path}
          </small>
        </div>
        <div className="header-right" style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            {/* Polling Controls */}
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px'}}>
                <button 
                    onClick={() => {
                        console.log('[PulseView] Toggling polling. Current:', isPolling);
                        setIsPolling(prev => !prev);
                    }}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px', display: 'flex', alignItems: 'center', color: '#64748b'
                    }}
                    title={isPolling ? "Pause Updates" : "Resume Updates"}
                >
                    {isPolling ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    )}
                </button>
                <select 
                    value={pollInterval} 
                    onChange={(e) => setPollInterval(Number(e.target.value))}
                    disabled={!isPolling}
                    style={{
                        background: 'transparent', border: 'none', fontSize: '0.9em', 
                        cursor: isPolling ? 'pointer' : 'not-allowed', outline: 'none',
                        color: isPolling ? '#334155' : '#94a3b8'
                    }}
                >
                    <option value={1000}>1s</option>
                    <option value={3000}>3s</option>
                    <option value={5000}>5s</option>
                    <option value={10000}>10s</option>
                </select>
            </div>

            {lastUpdated && <span className="last-updated">Updated: {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </header>

      <div className="pulse-grid">
        <SystemCard stats={stats?.system} />
        <AppHealthCard 
            php={stats?.phpFpm} 
            db={stats?.database} 
            onFpmClick={handleOpenFpmDetails}
            onDbClick={handleOpenDbDetails}
        />
        <QueueCard queue={stats?.queue} />
        <ExceptionsCard logs={stats?.logs} projectId={currentProject.path} />
      </div>

      {modalType && (
          <DetailsModal 
              title={modalType === 'fpm' ? 'PHP-FPM Processes' : 'Database Details'} 
              onClose={closeModal} 
              loading={modalLoading}
          >
              {modalType === 'fpm' && modalData && (
                  Array.isArray(modalData) ? (
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9em'}}>
                        <thead>
                            <tr style={{background: '#f1f5f9', textAlign: 'left'}}>
                                <th style={{padding: '8px'}}>PID</th>
                                <th style={{padding: '8px'}}>User</th>
                                <th style={{padding: '8px'}}>CPU%</th>
                                <th style={{padding: '8px'}}>Mem%</th>
                                <th style={{padding: '8px'}}>Command</th>
                            </tr>
                        </thead>
                        <tbody>
                            {modalData.map(p => (
                                <tr key={p.pid} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '8px'}}>{p.pid}</td>
                                    <td style={{padding: '8px'}}>{p.user}</td>
                                    <td style={{padding: '8px'}}>{p.cpu}</td>
                                    <td style={{padding: '8px'}}>{p.memory}</td>
                                    <td style={{padding: '8px', fontFamily: 'monospace'}}>{p.command}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  ) : <div>{JSON.stringify(modalData)}</div>
              )}

              {modalType === 'db' && modalData && (
                  <div>
                      <h4>Active Queries (Process List)</h4>
                      {modalData.full_processlist && modalData.full_processlist.length > 0 ? (
                           <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', marginBottom: '20px'}}>
                            <thead>
                                <tr style={{background: '#f1f5f9', textAlign: 'left'}}>
                                    <th style={{padding: '8px'}}>ID</th>
                                    <th style={{padding: '8px'}}>State</th>
                                    <th style={{padding: '8px'}}>Time</th>
                                    <th style={{padding: '8px'}}>Info</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(modalData.full_processlist).map(p => (
                                    <tr key={p.Id || p.id} style={{borderBottom: '1px solid #eee'}}>
                                        <td style={{padding: '8px'}}>{p.Id || p.id}</td>
                                        <td style={{padding: '8px'}}>{p.State || p.state || '-'}</td>
                                        <td style={{padding: '8px'}}>{p.Time || p.time}s</td>
                                        <td style={{padding: '8px', fontFamily: 'monospace', maxWidth: '300px', overflow:'hidden', textOverflow:'ellipsis'}}>
                                            {p.Info || p.info || 'NULL'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      ) : <p style={{color: '#666'}}>No active queries running.</p>}

                      <h4>InnoDB Status (Last Deadlock)</h4>
                      <pre style={{
                          background: '#1e293b', color: '#e2e8f0', padding: '10px', 
                          borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '0.8em',
                          whiteSpace: 'pre-wrap' 
                      }}>
                          {modalData.innodb_status || 'No status available'}
                      </pre>
                  </div>
              )}
          </DetailsModal>
      )}

      {/* DEBUG: Raw Data Dump */}
      <details style={{marginTop: '20px', padding: '10px', background: '#eee', borderRadius: '4px'}}>
          <summary style={{cursor: 'pointer', fontWeight: 'bold', color: '#000'}}>Debug: Raw Stats Data</summary>
          <pre style={{fontSize: '0.75em', overflowX: 'auto', marginTop: '10px', color: '#000'}}>
              {JSON.stringify(stats, null, 2)}
          </pre>
      </details>
      <style>{`
        .pulse-view {
          padding: 20px;
          height: 100%;
          overflow-y: auto;
          background: #f8fafc; /* Light gray bg for dashboard feel */
        }
        @media (prefers-color-scheme: dark) {
          .pulse-view { background: #1a1c22; }
        }

        .pulse-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-left h1 { margin: 0; display: inline-block; margin-right: 12px; }
        .live-indicator { 
            color: #10b981; 
            font-size: 0.9em; 
            font-weight: 600; 
            display: inline-flex; 
            align-items: center; 
            background: rgba(16, 185, 129, 0.1);
            padding: 4px 8px;
            border-radius: 12px;
        }
        .pulse-dot {
            width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 6px;
            animation: pulse-animation 2s infinite;
        }
        .last-updated { font-size: 0.8em; color: #888; }

        @keyframes pulse-animation {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .pulse-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          grid-auto-rows: minmax(180px, auto);
        }

        .pulse-card {
            background: var(--bg-secondary, #fff);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); /* Subtle shadow */
            border: 1px solid var(--border-color, #e2e8f0);
            display: flex;
            flex-direction: column;
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--border-color, #f1f5f9);
            padding-bottom: 12px;
        }
        
        .card-title {
            font-size: 1.1em;
            font-weight: 600;
            color: var(--text-primary, #334155);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .metric-big {
            font-size: 2.5em;
            font-weight: 700;
            color: var(--text-primary);
            line-height: 1;
        }
        .metric-label {
            font-size: 0.9em;
            color: var(--text-secondary, #64748b);
            margin-top: 4px;
        }

        .system-stats-row {
            display: flex;
            justify-content: space-around;
            text-align: center;
            margin-top: 10px;
        }
        
        .status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color, #f1f5f9);
        }
        .status-row:last-child { border-bottom: none; }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .status-success { background: #dcfce7; color: #166534; }
        .status-warning { background: #fef9c3; color: #854d0e; }
        .status-error { background: #fee2e2; color: #991b1b; }
        .status-neutral { background: #f1f5f9; color: #475569; }

      `}</style>
    </div>
  );
}

// Sub-components for widgets

function SystemCard({ stats }) {
    if (!stats) return <div className="pulse-card">Loading...</div>;
    
    return (
        <div className="pulse-card">
            <div className="card-header">
                <span className="card-title">🖥️ System</span>
            </div>
            <div className="system-stats-row">
                <div>
                   <div className="metric-big">{stats.cpu}%</div>
                   <div className="metric-label">CPU</div>
                </div>
                <div>
                    <div className="metric-big">{stats.memory.percent}%</div>
                    <div className="metric-label">RAM</div>
                </div>
            </div>
            <div style={{marginTop: 'auto', paddingTop: '10px', fontSize: '0.9em', color: '#666'}}>
                Uptime: {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
            </div>
        </div>
    );
}

// ... SystemCard ...

function AppHealthCard({ php, db, onFpmClick, onDbClick }) {
    return (
        <div className="pulse-card">
             <div className="card-header">
                <span className="card-title">🩺 Health</span>
            </div>
            
            <div className="status-row" onClick={onDbClick} style={{cursor: 'pointer', transition: 'background 0.2s', padding: '12px 0'}}>
                <span>Database <small style={{color: '#3b82f6', marginLeft: '5px'}}>ℹ️</small></span>
                <div style={{textAlign: 'right'}}>
                    <span className={`status-badge ${db?.status === 'connected' ? 'status-success' : 'status-error'}`} 
                          title={db?.error || ''}>
                        {db?.status?.toUpperCase() || 'ERROR'}
                    </span>
                    {/* ... error display ... */}
                    {db?.error && (
                        <div style={{color: '#ef4444', fontSize: '0.75em', marginTop: '4px', maxWidth: '150px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={db.error}>
                           {db.error}
                        </div>
                    )}
                    {db?.deadlocks > 0 && (
                         <div style={{color: 'red', fontSize: '0.8em', marginTop: '4px'}}>
                             ⚠️ {db.deadlocks} Deadlocks
                         </div>
                    )}
                </div>
            </div>

            <div className="status-row" onClick={onFpmClick} style={{cursor: 'pointer', transition: 'background 0.2s', padding: '12px 0'}}>
                <span>PHP-FPM <small style={{color: '#3b82f6', marginLeft: '5px'}}>ℹ️</small></span>
                <div style={{textAlign: 'right'}}>
                     {php?.running ? (
                         <>
                             <span className="status-badge status-success">RUNNING</span>
                             <div style={{fontSize: '0.8em', color: '#666', marginTop: '4px'}}>
                                 {php.processes} Processes
                             </div>
                         </>
                     ) : (
                         <>
                            <span className="status-badge status-error" title={php?.error || 'Process not found'}>
                                NOT FOUND
                            </span>
                            {/* ... error display ... */}
                             {php?.error && (
                                <div style={{color: '#ef4444', fontSize: '0.75em', marginTop: '4px'}}>
                                    {php.error}
                                </div>
                            )}
                         </>
                     )}
                </div>
            </div>
        </div>
    );
}

// ... other cards ...


function QueueCard({ queue }) {
    return (
        <div className="pulse-card">
             <div className="card-header">
                <span className="card-title">🔄 Queues</span>
            </div>
            
            <div style={{textAlign: 'center', padding: '10px 0'}}>
                <div className="metric-big" style={{color: queue?.failed > 0 ? '#ef4444' : '#10b981'}}>
                    {queue?.failed || 0}
                </div>
                <div className="metric-label">Failed Jobs</div>
            </div>
            
            <div style={{marginTop: 'auto', textAlign: 'center'}}>
                 <Link to="/queue" style={{color: '#3b82f6', textDecoration: 'none', fontSize: '0.9em'}}>
                    Manage Queues →
                 </Link>
            </div>
        </div>
    );
}

function ExceptionsCard({ logs, projectId }) {
    return (
        <div className="pulse-card">
             <div className="card-header">
                <span className="card-title">⚠️ Exceptions (1h)</span>
            </div>
            
            <div style={{textAlign: 'center', padding: '10px 0'}}>
                 {/* Placeholder for now as LogIndexer integration is simplified */}
                 <div className="metric-big" style={{color: '#64748b'}}>
                    {/* {logs?.errors_past_hour || '-'} */}
                    -
                 </div>
                 <div className="metric-label">Recent Errors</div>
            </div>
             <div style={{marginTop: 'auto', textAlign: 'center', fontSize: '0.85em', color: '#888'}}>
                 <i>Log parsing integration pending</i>
            </div>
        </div>
    );
}

export default PulseView;
