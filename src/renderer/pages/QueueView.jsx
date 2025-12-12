import React, { useState, useEffect } from 'react';

function QueueView({ currentProject }) {
  const [workerStatus, setWorkerStatus] = useState('stopped');
  const [output, setOutput] = useState([]);
  const [failedJobs, setFailedJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (currentProject) {
      checkStatus();
      loadFailedJobs();
      
      const removeListener = window.api.onQueueOutput((data) => {
        setOutput(prev => [...prev.slice(-100), data]); // Keep last 100 lines
      });

      return () => {
        // window.api.removeListener('queue:output') - if we implemented it
      };
    }
  }, [currentProject]);

  const checkStatus = async () => {
    if (!currentProject) return;
    const result = await window.api.queueStatus(currentProject.id);
    setWorkerStatus(result.status);
  };

  const loadFailedJobs = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const result = await window.api.queueFailedList(currentProject.path);
      if (result.success) {
        setFailedJobs(result.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleWorker = async () => {
    if (!currentProject) return;
    const action = workerStatus === 'running' ? 'stop' : 'start';
    await window.api.queueControl(currentProject.id, action, currentProject.path);
    if (action === 'start') {
        setOutput(prev => [...prev, '--- Starting Worker ---']);
    } else {
        setOutput(prev => [...prev, '--- Stopping Worker ---']);
    }
    setTimeout(checkStatus, 1000);
  };

  const handleRetry = async (jobId) => {
      if (!confirm('Retry this job?')) return;
      await window.api.queueRetry(currentProject.path, jobId);
      loadFailedJobs();
  };

  const handleForget = async (jobId) => {
      if (!confirm('Delete this failed job?')) return;
      await window.api.queueForget(currentProject.path, jobId);
      loadFailedJobs();
  };

  const handleFlush = async () => {
      if (!confirm('Delete ALL failed jobs?')) return;
      await window.api.queueFlush(currentProject.path);
      loadFailedJobs();
  };
  
  // Format payload
  const formatPayload = (payload) => {
      try {
          const obj = JSON.parse(payload);
          return JSON.stringify(obj, null, 2);
      } catch (e) {
          return payload;
      }
  };

  if (!currentProject) {
    return <div className="p-20">Please select a project.</div>;
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Queue Management</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ 
                width: '10px', height: '10px', borderRadius: '50%', 
                background: workerStatus === 'running' ? 'var(--accent-green)' : 'var(--text-secondary)',
                marginRight: '5px'
            }}></span>
            <span style={{ marginRight: '15px' }}>{workerStatus.toUpperCase()}</span>

            <button onClick={toggleWorker}>
                {workerStatus === 'running' ? 'Stop Worker' : 'Start Worker'}
            </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'hidden' }}>
          
          {/* Main Area: Failed Jobs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <h3>Failed Jobs ({failedJobs.length})</h3>
                      <div>
                          <button onClick={loadFailedJobs} style={{ marginRight: '8px' }}>Refresh</button>
                          {failedJobs.length > 0 && 
                            <button onClick={handleFlush} style={{ background: 'var(--accent-red)', border: 'none' }}>Flush All</button>
                          }
                      </div>
                  </div>
                  <div className="card-content" style={{ padding: 0, flex: 1, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ padding: '8px' }}>ID</th>
                                  <th style={{ padding: '8px' }}>Connection/Queue</th>
                                  <th style={{ padding: '8px' }}>Failed At</th>
                                  <th style={{ padding: '8px' }}>Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                              {failedJobs.map(job => (
                                  <tr key={job.id} 
                                    style={{ 
                                        borderBottom: '1px solid var(--border-color)', 
                                        background: selectedJob?.id === job.id ? 'var(--bg-tertiary)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setSelectedJob(job)}
                                  >
                                      <td style={{ padding: '8px' }}>{job.id}</td>
                                      <td style={{ padding: '8px' }}>
                                          <div>{job.connection}</div>
                                          <div style={{ color: 'var(--text-secondary)' }}>{job.queue}</div>
                                      </td>
                                      <td style={{ padding: '8px' }}>{job.failed_at}</td>
                                      <td style={{ padding: '8px' }}>
                                          <button onClick={(e) => { e.stopPropagation(); handleRetry(job.id); }}>Retry</button>
                                          <button onClick={(e) => { e.stopPropagation(); handleForget(job.id); }} style={{ marginLeft: '5px', color: 'var(--accent-red)' }}>Del</button>
                                      </td>
                                  </tr>
                              ))}
                              {failedJobs.length === 0 && (
                                  <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>No failed jobs.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Console Output */}
              <div className="card" style={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header"><h3>Worker Output</h3></div>
                  <div className="output-console" style={{ flex: 1, overflowY: 'auto' }}>
                      {output.map((line, i) => (
                          <div key={i}>{line}</div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Right Panel: Job Detail */}
          {selectedJob && (
              <div className="card" style={{ width: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="card-header">
                      <h3>Job Detail #{selectedJob.id}</h3>
                      <button onClick={() => setSelectedJob(null)}>Close</button>
                  </div>
                  <div className="card-content" style={{ overflowY: 'auto' }}>
                      <h4>Payload</h4>
                      <div className="output-console" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                          {formatPayload(selectedJob.payload)}
                      </div>

                      <h4>Exception</h4>
                      <div className="output-console" style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                          {selectedJob.exception.substring(0, 2000)}...
                      </div>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
}

export default QueueView;
