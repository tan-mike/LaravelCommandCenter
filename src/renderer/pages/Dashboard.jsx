import React, { useState, useEffect } from 'react';

function Dashboard({ currentProject }) {
  const [projectInfo, setProjectInfo] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [failedJobs, setFailedJobs] = useState([]);

  useEffect(() => {
    if (currentProject) {
      loadProjectInfo();
    }
  }, [currentProject]);

  const loadProjectInfo = async () => {
    if (!currentProject?.config) return;

    try {
      const config = JSON.parse(currentProject.config);
      setProjectInfo(config);

      // Load migration status
      const migStatus = await window.api.getMigrationStatus(currentProject.path);
      if (migStatus.success) {
        setMigrationStatus(migStatus.data);
      }

      // Load failed jobs
      const jobs = await window.api.getFailedJobs(currentProject.path);
      if (jobs.success) {
        setFailedJobs(jobs.data);
      }
    } catch (error) {
      console.error('Failed to load project info:', error);
    }
  };

  if (!currentProject) {
    return (
      <div className="card">
        <h2>Welcome to Laravel Dev Control Center</h2>
        <p>Select or add a Laravel project to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Project Overview</h2>
          <button onClick={loadProjectInfo}>Refresh</button>
        </div>
        <div className="card-content">
          {projectInfo ? (
            <div className="grid grid-2">
              <div>
                <strong>Project:</strong> {projectInfo.name}
              </div>
              <div>
                <strong>Laravel Version:</strong> {projectInfo.laravel_version}
              </div>
              <div>
                <strong>Path:</strong> <code>{projectInfo.path}</code>
              </div>
              <div>
                <strong>Storage Link:</strong>{' '}
                {projectInfo.missing_storage_link ? (
                  <span className="badge error">Missing</span>
                ) : (
                  <span className="badge success">OK</span>
                )}
              </div>
            </div>
          ) : (
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      </div>

      {projectInfo && projectInfo.packages && projectInfo.packages.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Installed Packages</h2>
          </div>
          <div className="card-content">
            <div className="grid grid-3">
              {projectInfo.packages.map((pkg, index) => (
                <div key={index} className="badge success">
                  {pkg.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {projectInfo && projectInfo.queues && (
        <div className="card">
          <div className="card-header">
            <h2>Queues</h2>
          </div>
          <div className="card-content">
            {projectInfo.queues.map((queue, index) => (
              <span key={index} className="badge" style={{ marginRight: '8px' }}>
                {queue}
              </span>
            ))}
          </div>
        </div>
      )}

      {failedJobs && failedJobs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Failed Jobs</h2>
            <span className="badge error">{failedJobs.length}</span>
          </div>
          <div className="card-content">
            <p>There are {failedJobs.length} failed jobs. Use the Macros page to retry them.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
