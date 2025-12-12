# Laravel Dev Control Center

Cross-platform developer helper suite built to speed up development, debugging, and maintenance of Laravel applications.

## Features (MVP)

- **Project Autodetection**: Automatically detect Laravel projects and extract key information
- **One-Click Macros**: Common troubleshooting tasks with a single click
  - Clear caches (config, route, view, cache, optimize)
  - Rebuild autoload
  - Retry failed jobs
  - Cache configuration
- **Project Dashboard**: View project overview, installed packages, queues, and health status
- **Artisan Integration**: Execute artisan commands directly from the UI

## Installation

### Development

```bash
# Install dependencies
npm install

# Run in development mode (requires 2 terminal tabs)
# Tab 1: Start webpack watch
npm run watch

# Tab 2: Start Electron
npm start

# Build for production
npm run build

# Build executables
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
npm run build:all   # All platforms
```

### Usage

1. Launch the application
2. Click "Add Project" and enter the path to your Laravel project
3. The app will scan and detect your Laravel configuration
4. Use the dashboard to view project information
5. Navigate to Macros to run one-click troubleshooting commands

## Requirements

- Node.js 18+
- PHP 7.4+ (for Laravel projects)
- Windows 10+, macOS 10.14+, or Linux

## Technology Stack

- **Desktop Framework**: Electron
- **UI Framework**: React
- **Database**: SQLite (better-sqlite3)
- **Build Tool**: Electron Builder

## Project Structure

```
LaravelCommandCenter/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # Preload script for IPC
│   ├── db/                     # Database layer
│   │   ├── Database.js
│   │   └── schema.sql
│   ├── services/               # Core services
│   │   ├── ProjectScanner.js
│   │   ├── ArtisanBridge.js
│   │   └── MacroRunner.js
│   └── renderer/               # React UI
│       ├── index.html
│       ├── index.jsx
│       ├── App.jsx
│       ├── components/
│       ├── pages/
│       └── styles/
├── package.json
├── webpack.config.js
└── electron-builder.json
```

## License

MIT

## Roadmap

See [implementation_plan.md](./implementation_plan.md) for detailed roadmap and planned features.

### MVP (Current Phase)

- ✅ Project autodetection
- ✅ Basic macros
- ✅ Dashboard UI
- ⏳ Log intelligence

### v1 (Planned)

- Route explorer
- Model & DB analyzer
- Health checker (doctor)
- Testing helpers

### v2 (Future)

- Error spike detection
- GitHub/GitLab integration
- Deployment simulator
- Plugin system
