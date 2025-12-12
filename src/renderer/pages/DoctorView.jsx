import React, { useState, useEffect } from 'react';

function DoctorView({ currentProject }) {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentProject) {
      runDoctor();
    }
  }, [currentProject]);

  const runDoctor = async () => {
    if (!currentProject?.path) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.doctorCheck(currentProject.path);
      if (result.success) {
        setChecks(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return <div className="p-20">Please select a project.</div>;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'var(--accent-green)';
      case 'warning': return 'var(--accent-yellow)';
      case 'error': return 'var(--accent-red)';
      default: return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Environment Doctor</h1>
        <button onClick={runDoctor} disabled={loading}>
          {loading ? 'Checking...' : 'Run Checks'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
          <div className="card-content">
            Error running checks: {error}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {checks.map(check => (
          <div key={check.id} className="card" style={{ borderTop: `4px solid ${getStatusColor(check.status)}` }}>
            <div className="card-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>{check.label}</h3>
                <span style={{ fontSize: '20px' }}>{getStatusIcon(check.status)}</span>
              </div>
              
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                {check.message}
              </div>

              {check.status === 'error' && check.error && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '8px', 
                  background: 'rgba(255,0,0,0.1)', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  {check.error}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {!loading && checks.length === 0 && !error && (
           <div className="card">
             <div className="card-content">No checks run yet.</div>
           </div>
        )}
      </div>
    </div>
  );
}

export default DoctorView;
