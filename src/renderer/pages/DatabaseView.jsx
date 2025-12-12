import React, { useState, useEffect } from 'react';

function DatabaseView({ currentProject }) {
  const [migrations, setMigrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [output, setOutput] = useState('');
  const [filter, setFilter] = useState('all');
  const [steps, setSteps] = useState(1);
  const [environment, setEnvironment] = useState('unknown');

  useEffect(() => {
    if (currentProject) {
      loadMigrations();
      loadEnvironment();
    }
  }, [currentProject]);

  const loadEnvironment = async () => {
    if (!currentProject) return;
    const env = await window.api.dbEnv(currentProject.path);
    setEnvironment(env);
  };

  const loadMigrations = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const result = await window.api.dbMigrations(currentProject.path);
      if (result.success) {
        setMigrations(result.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const executeAction = async (actionName, apiCall) => {
      // Safety Check
      const isProduction = environment === 'production' || environment === 'prod';
      let message = `Are you sure you want to ${actionName}?`;
      
      if (isProduction) {
          message = `⚠️ CRITICAL WARNING ⚠️\n\nYou are in PRODUCTION environment.\nThis action (${actionName}) is DESTRUCTIVE.\n\nAre you absolutely sure?`;
      }

      if (!confirm(message)) return;

      setProcessing(true);
      setOutput(`Running ${actionName}...\n`);
      try {
          const result = await apiCall();
          setOutput(prev => prev + (result.output || '') + '\n' + (result.error || '') + '\nDone.');
          loadMigrations();
      } catch (e) {
          setOutput(prev => prev + 'Error: ' + e.message);
      }
      setProcessing(false);
  };

  const handleMigrate = () => executeAction('Run Migrations', () => window.api.dbMigrate(currentProject.path));
  
  const handleRollback = () => executeAction(`Rollback (Steps: ${steps})`, () => window.api.dbRollback(currentProject.path, parseInt(steps)));

  const handleReset = () => executeAction('RESET DATABASE', () => window.api.dbReset(currentProject.path));

  const handleRefresh = () => executeAction('REFRESH DATABASE', () => window.api.dbRefresh(currentProject.path));

  if (!currentProject) {
    return <div className="p-20">Please select a project.</div>;
  }

  const filteredMigrations = filter === 'pending' 
    ? migrations.filter(m => !m.ran) 
    : migrations;

  const pendingCount = migrations.filter(m => !m.ran).length;

  return (
    <div className="view-container">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>Database Tools</h1>
            <span className={`badge ${environment === 'production' ? 'error' : 'success'}`} style={{ fontSize: '10px' }}>
                ENV: {environment.toUpperCase()}
            </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) 1fr', gap: '20px', height: '100%', overflow: 'hidden' }}>
          
          {/* Left Column: Migrations List */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Migrations</h3>
                  <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '4px' }}>
                      <option value="all">All Migrations</option>
                      <option value="pending">Pending Only</option>
                  </select>
              </div>
              <div className="card-content" style={{ padding: 0, flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                              <th style={{ padding: '10px' }}>Status</th>
                              <th style={{ padding: '10px' }}>Migration Name</th>
                              <th style={{ padding: '10px' }}>Batch</th>
                          </tr>
                      </thead>
                      <tbody>
                          {loading ? (
                              <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
                          ) : filteredMigrations.length === 0 ? (
                              <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>No migrations found.</td></tr>
                          ) : (
                              filteredMigrations.map((m, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                      <td style={{ padding: '10px' }}>
                                          {m.ran ? (
                                              <span className="badge success">Ran</span>
                                          ) : (
                                              <span className="badge warning">Pending</span>
                                          )}
                                      </td>
                                      <td style={{ padding: '10px', fontFamily: 'monospace' }}>{m.name}</td>
                                      <td style={{ padding: '10px' }}>{m.batch}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Right Column: Controls & Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Actions Card */}
              <div className="card">
                  <div className="card-header"><h3>Actions</h3></div>
                  <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      
                      {/* Migrate */}
                      <button onClick={handleMigrate} disabled={processing || pendingCount === 0} className={pendingCount > 0 ? "primary" : ""} style={{ width: '100%' }}>
                          {processing ? 'Running...' : `Run Pending Migrations (${pendingCount})`}
                      </button>

                      <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', width: '100%' }} />

                      {/* Rollback */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Steps</label>
                              <input 
                                type="number" 
                                min="1" 
                                value={steps} 
                                onChange={e => setSteps(e.target.value)}
                                style={{ padding: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                              />
                          </div>
                          <button onClick={handleRollback} disabled={processing} style={{ flex: 2, background: 'var(--bg-tertiary)' }}>
                              Rollback
                          </button>
                      </div>

                      <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', width: '100%' }} />

                      {/* Danger Zone */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: 'bold' }}>DANGER ZONE</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={handleRefresh} disabled={processing} style={{ flex: 1, background: 'var(--accent-red)', opacity: 0.8, color: 'white' }}>
                                  Refresh
                              </button>
                              <button onClick={handleReset} disabled={processing} style={{ flex: 1, background: 'var(--accent-red)', color: 'white' }}>
                                  Reset
                              </button>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              Refresh = Rollback all + Migrate.<br/>
                              Reset = Rollback all.
                          </p>
                      </div>

                  </div>
              </div>

              {/* Console Output */}
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="card-header"><h3>Console Output</h3></div>
                <div className="output-console" style={{ flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {output || 'No output.'}
                </div>
              </div>

          </div>

      </div>
    </div>
  );
}

export default DatabaseView;
