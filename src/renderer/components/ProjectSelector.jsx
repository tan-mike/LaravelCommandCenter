import React, { useState, useEffect } from 'react';
import '../styles/components.css';

function ProjectSelector({ currentProject, onProjectChange }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const result = await window.api.getProjects();
      if (result.success) {
        setProjects(result.data);
        if (result.data.length > 0 && !currentProject) {
          onProjectChange(result.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
    setLoading(false);
  };

  const handleProjectSelect = (e) => {
    const projectPath = e.target.value;
    const project = projects.find(p => p.path === projectPath);
    onProjectChange(project);
  };

  const handleAddProject = () => {
    setShowAddProject(true);
  };

  return (
    <div className="project-selector">
      {loading ? (
        <span>Loading projects...</span>
      ) : (
        <>
          <select value={currentProject?.path || ''} onChange={handleProjectSelect}>
            <option value="">Select a project...</option>
            {projects.map(project => (
              <option key={project.id} value={project.path}>
                {project.name}
              </option>
            ))}
          </select>
          <button onClick={handleAddProject} className="primary">
            Add Project
          </button>
        </>
      )}
      
      {showAddProject && (
        <AddProjectModal 
          onClose={() => setShowAddProject(false)}
          onProjectAdded={(project) => {
            loadProjects();
            onProjectChange(project);
            setShowAddProject(false);
          }}
        />
      )}
    </div>
  );
}

function AddProjectModal({ onClose, onProjectAdded }) {
  const [projectPath, setProjectPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (!projectPath) {
      setError('Please enter a project path');
      return;
    }

    setScanning(true);
    setError('');

    try {
      const result = await window.api.scanProject(projectPath);
      if (result.success) {
        onProjectAdded(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    }

    setScanning(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Laravel Project</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-content">
          <div className="form-group">
            <label>Project Path</label>
            <input
              type="text"
              placeholder="C:\path\to\laravel-project"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              disabled={scanning}
            />
          </div>
          {error && (
            <div className="error-message">{error}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={scanning}>
            Cancel
          </button>
          <button onClick={handleScan} className="primary" disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectSelector;
