const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigService {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'config.json');
    this.config = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return {
      editor: {
        app: 'vscode', // vscode, phpstorm, sublime, atom, antigravity, custom
        customPath: '', // For custom command
      },
      theme: 'dark'
    };
  }

  _save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get(key, defaultValue = null) {
    // simple dot notation support for one level e.g., 'editor.app'
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      return this.config[parent] && this.config[parent][child] !== undefined 
        ? this.config[parent][child] 
        : defaultValue;
    }
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key, value) {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      if (!this.config[parent]) this.config[parent] = {};
      this.config[parent][child] = value;
    } else {
      this.config[key] = value;
    }
    this._save();
    return this.config;
  }

  getAll() {
    return this.config;
  }
}

module.exports = new ConfigService();
