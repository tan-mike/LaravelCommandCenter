import React, { useState, useEffect } from 'react';

function RoutesView({ currentProject }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState({ editor: { app: 'vscode' } });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadRoutes();
    }
  }, [currentProject]);

  const loadSettings = async () => {
    try {
      const config = await window.api.getSettings();
      if (config) setSettings(config);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadRoutes = async () => {
    if (!currentProject?.path) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.routesGet(currentProject.path);
      if (result.success) {
        setRoutes(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (route) => {
    if (!route.file) {
      alert('Could not resolve file path for this route.');
      return;
    }

    const { app, customPath } = settings.editor || {};
    let url = '';
    const filePath = route.file;
    const line = route.line || 1;

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
    }

    if (url) {
      window.location.href = url;
    }
  };

  const filteredRoutes = routes.filter(r => {
    const term = search.toLowerCase();
    return (
      r.uri.toLowerCase().includes(term) ||
      r.action.toLowerCase().includes(term) ||
      (r.name && r.name.toLowerCase().includes(term))
    );
  });

  const getMethodColor = (method) => {
    if (method.includes('GET')) return 'var(--accent-blue)';
    if (method.includes('POST')) return 'var(--accent-green)';
    if (method.includes('PUT') || method.includes('PATCH')) return 'var(--accent-yellow)';
    if (method.includes('DELETE')) return 'var(--accent-red)';
    return 'var(--text-secondary)';
  };

  if (!currentProject) {
    return <div className="p-20">Please select a project.</div>;
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Routes Explorer</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={loadRoutes} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
             </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Routes ({filteredRoutes.length})</h3>
          <input 
            type="text" 
            placeholder="Search routes..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '13px', width: '250px' }}
          />
        </div>
        
        {error && <div className="p-10" style={{ color: 'var(--accent-red)' }}>Error: {error}</div>}
        
        <div className="card-content" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Method</th>
                  <th style={{ padding: '10px' }}>URI</th>
                  <th style={{ padding: '10px' }}>Name</th>
                  <th style={{ padding: '10px' }}>Action</th>
                  <th style={{ padding: '10px' }}>Middleware</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>Loading routes...</td></tr>
                ) : filteredRoutes.length === 0 ? (
                   <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>No routes found</td></tr>
                ) : (
                  filteredRoutes.map((route, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px' }}>
                         <span style={{ 
                           fontWeight: 'bold', 
                           color: getMethodColor(route.method),
                           fontSize: '11px', 
                           border: `1px solid ${getMethodColor(route.method)}`,
                           padding: '2px 4px',
                           borderRadius: '4px'
                         }}>
                           {route.method}
                         </span>
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace' }}>/{route.uri}</td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{route.name || '-'}</td>
                      <td style={{ padding: '10px' }}>
                         <span 
                           style={{ 
                             cursor: route.file ? 'pointer' : 'default', 
                             color: route.file ? 'var(--accent-blue)' : 'inherit',
                             textDecoration: route.file ? 'underline' : 'none'
                           }}
                           onClick={() => route.file && handleOpenAction(route)}
                           title={route.file || 'Unknown file'}
                         >
                           {route.action}
                         </span>
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace:'nowrap' }}>
                        {Array.isArray(route.middleware) ? route.middleware.join(', ') : route.middleware}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoutesView;
