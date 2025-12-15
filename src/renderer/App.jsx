import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MacrosView from './pages/MacrosView';
import LogsView from './pages/LogsView';
import SettingsView from './pages/SettingsView';
import RoutesView from './pages/RoutesView';
import DoctorView from './pages/DoctorView';
import ModelsView from './pages/ModelsView';
import QueueView from './pages/QueueView';
import DatabaseView from './pages/DatabaseView'; // Added
import PulseView from './pages/PulseView'; // Added
import ProjectSelector from './components/ProjectSelector';

function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Listen for update events
    window.api.onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });

    window.api.onUpdateDownloaded(() => {
      const install = confirm('Update downloaded. Restart now to install?');
      if (install) {
        window.api.installUpdate();
      }
    });
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <TopBar 
            currentProject={currentProject} 
            setCurrentProject={setCurrentProject}
            updateAvailable={updateAvailable}
          />
          <div className="content-area">
            <Routes>
              <Route path="/" element={<Dashboard currentProject={currentProject} />} />
              <Route path="/pulse" element={<PulseView currentProject={currentProject} />} />
              <Route path="/macros" element={<MacrosView currentProject={currentProject} />} />
              <Route path="/logs" element={<LogsView currentProject={currentProject} />} />
              <Route path="/routes" element={<RoutesView currentProject={currentProject} />} />
              <Route path="/doctor" element={<DoctorView currentProject={currentProject} />} />
              <Route path="/models" element={<ModelsView currentProject={currentProject} />} />
              <Route path="/queue" element={<QueueView currentProject={currentProject} />} />
              <Route path="/database" element={<DatabaseView currentProject={currentProject} />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/pulse', label: 'Pulse', icon: '💓' },
    { path: '/macros', label: 'Macros', icon: '⚡' },
    { path: '/logs', label: 'Logs', icon: '📋' },
    { path: '/routes', label: 'Routes', icon: '🛣️' },
    { path: '/doctor', label: 'Doctor', icon: '🩺' },
    { path: '/models', label: 'Models', icon: '🗄️' },
    { path: '/queue', label: 'Queues', icon: '🔄' },
    { path: '/database', label: 'Database', icon: '🛢️' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Laravel DevControl</h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function TopBar({ currentProject, setCurrentProject, updateAvailable }) {
  return (
    <div className="top-bar">
      <ProjectSelector 
        currentProject={currentProject}
        onProjectChange={setCurrentProject}
      />
      {updateAvailable && (
        <div style={{ marginLeft: 'auto', color: 'var(--accent-green)' }}>
          Update available!
        </div>
      )}
    </div>
  );
}

export default App;
