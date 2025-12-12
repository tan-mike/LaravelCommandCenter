import React, { useState, useEffect } from 'react';

function SettingsView() {
  const [settings, setSettings] = useState({
    editor: { app: 'vscode', customPath: '' },
    theme: 'dark'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const config = await window.api.getSettings();
      setSettings(config || { editor: { app: 'vscode' } });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditorChange = (e) => {
    const app = e.target.value;
    updateSetting('editor', { ...settings.editor, app });
  };

  const handleCustomPathChange = (e) => {
    const customPath = e.target.value;
    updateSetting('editor', { ...settings.editor, customPath });
  };

  const updateSetting = async (key, value) => {
    setSettings(prev => {
      // Handle nested updates if needed, though shallow merge here might be simplistic
      // For now, we only have top level 'editor' which is an object
      return { ...prev, [key]: value };
    });
    await window.api.saveSetting(key, value);
  };

  if (loading) return <div className="p-20">Loading settings...</div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Settings</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3>Editor Integration</h3>
        </div>
        <div className="card-content">
          <p className="description">
            Choose which editor to open when clicking file paths in stack traces.
          </p>
          
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Preferred Editor</label>
            <select 
              value={settings.editor?.app || 'vscode'} 
              onChange={handleEditorChange}
              style={{ width: '100%', padding: '8px', marginTop: '4px' }}
            >
              <option value="vscode">VS Code (vscode://)</option>
              <option value="phpstorm">PHPStorm (phpstorm://)</option>
              <option value="sublime">Sublime Text (subl://)</option>
              <option value="atom">Atom (atom://)</option>
              <option value="custom">Custom Command</option>
            </select>
          </div>

          {settings.editor?.app === 'custom' && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Custom Protocol / Command</label>
              <input 
                type="text" 
                value={settings.editor?.customPath || ''}
                onChange={handleCustomPathChange}
                placeholder="e.g. my-editor://open?file=%file&line=%line"
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '20px' }}>
        <div className="card-header">
          <h3>Antigravity Integration</h3>
        </div>
        <div className="card-content">
          <p className="description">
            Copy context or open V1 dashboard when using "Ask Antigravity".
          </p>
          <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
             <strong>Deep Link Protocol:</strong> <code>antigravity://open</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
