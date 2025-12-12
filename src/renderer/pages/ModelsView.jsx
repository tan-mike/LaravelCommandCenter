import React, { useState, useEffect } from 'react';

function ModelsView({ currentProject }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    if (currentProject) {
      runAudit();
    }
  }, [currentProject]);

  const runAudit = async () => {
    if (!currentProject?.path) return;
    
    setLoading(true);
    setError(null);
    setExpandedRow(null);
    
    try {
      const result = await window.api.modelsAudit(currentProject.path);
      if (result.success) {
        setModels(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  if (!currentProject) {
    return <div className="p-20">Please select a project.</div>;
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Model & DB Analyzer</h1>
        <button onClick={runAudit} disabled={loading}>
          {loading ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
            <div className="card-content">Error: {error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
           <h3>Eloquent Models ({models.length})</h3>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-tertiary)' }}>
                   <th style={{ padding: '12px' }}>Class</th>
                   <th style={{ padding: '12px' }}>Table</th>
                   <th style={{ padding: '12px' }}>Rows</th>
                   <th style={{ padding: '12px' }}>Fillable</th>
                   <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>Running introspection script...</td></tr>
                ) : models.length === 0 && !error ? (
                  <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>No models found in app/Models</td></tr>
                ) : (
                  models.map((model, i) => (
                    <React.Fragment key={i}>
                        <tr 
                            onClick={() => toggleExpand(i)}
                            style={{ 
                                borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-color)', 
                                cursor: 'pointer',
                                background: expandedRow === i ? 'var(--bg-tertiary)' : 'transparent'
                            }}
                        >
                           <td style={{ padding: '12px', fontWeight: 'bold' }}>
                               {model.class.split('\\').pop()}
                               <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{model.class}</div>
                           </td>
                           <td style={{ padding: '12px' }}>{model.table}</td>
                           <td style={{ padding: '12px' }}>{model.rows !== undefined ? model.rows.toLocaleString() : '-'}</td>
                           <td style={{ padding: '12px' }}>
                               {model.fillable && model.fillable.length > 0 ? (
                                   <span title={model.fillable.join(', ')}>{model.fillable.length} fields</span>
                               ) : (
                                   <span style={{ color: 'var(--text-secondary)' }}>-</span>
                               )}
                           </td>
                           <td style={{ padding: '12px' }}>
                               {model.error ? (
                                   <span className="badge error">Error</span>
                               ) : model.db_error ? (
                                   <span className="badge warning">DB Error</span>
                               ) : (
                                   <span className="badge success">OK</span>
                               )}
                           </td>
                        </tr>
                        {expandedRow === i && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                <td colSpan="5" style={{ padding: '0 12px 12px 12px' }}>
                                    <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '4px' }}>
                                        {model.error && <div style={{ color: 'var(--accent-red)' }}><strong>Error:</strong> {model.error}</div>}
                                        {model.db_error && <div style={{ color: 'var(--accent-yellow)' }}><strong>DB Error:</strong> {model.db_error}</div>}
                                        
                                        {model.columns && (
                                            <>
                                                <h4>Table Columns ({model.columns.length})</h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                    {model.columns.map(col => (
                                                        <span key={col} style={{ 
                                                            fontSize: '11px', 
                                                            padding: '2px 6px', 
                                                            background: 'var(--bg-tertiary)', 
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: '4px'
                                                        }}>
                                                            {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        
                                        {model.casts && Object.keys(model.casts).length > 0 && (
                                            <div style={{ marginTop: '12px' }}>
                                                <h4>Casts</h4>
                                                <pre style={{ fontSize: '11px', marginTop: '4px' }}>
                                                    {JSON.stringify(model.casts, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}

export default ModelsView;
