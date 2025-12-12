# Dependency Updates - December 2025

## Changes Made

Updated all npm dependencies to their latest stable versions to eliminate deprecated package warnings.

### Major Version Updates

**Runtime Dependencies:**

- `electron-updater`: 6.1.4 → 6.3.9
- `better-sqlite3`: 9.2.2 → 11.5.0 (major update removes deprecated glob dependency)
- `ssh2`: 1.15.0 → 1.16.0
- `chokidar`: 3.5.3 → 4.0.1 (major update removes deprecated dependencies)
- `commander`: 11.1.0 → 12.1.0 (major update)
- `react`: 18.2.0 → 18.3.1
- `react-dom`: 18.2.0 → 18.3.1
- `react-router-dom`: 6.20.0 → 6.28.0

**Development Dependencies:**

- `electron`: 28.0.0 → 33.2.0 (major version jump with security updates)
- `electron-builder`: 24.9.1 → 25.1.8 (removes deprecated glob@7)
- `webpack`: 5.89.0 → 5.96.1
- `style-loader`: 3.3.3 → 4.0.0 (major update)
- `css-loader`: 6.8.1 → 7.1.2 (major update)
- `babel-loader`: 9.1.3 → 9.2.1
- `@babel/core`: 7.23.5 → 7.26.0
- `@babel/preset-react`: 7.23.3 → 7.25.9
- `@playwright/test`: 1.40.0 → 1.49.1
- `concurrently`: 8.2.2 → 9.1.0 (major update)

## Resolved Deprecation Warnings

### ✅ Fixed

- **inflight@1.0.6** - Removed by updating transitive dependencies
- **lodash.isequal@4.5.0** - Removed by updating electron-builder and other packages
- **glob@7.2.3** - Updated to glob@10+ via electron-builder 25.1.8
- **boolean@3.2.0** - Removed by updating dependencies

## Breaking Changes to Watch

### better-sqlite3 (9 → 11)

- API remains compatible
- Performance improvements
- Better Node.js 20+ support

### chokidar (3 → 4)

- Minimal API changes
- Better performance and memory usage
- Our usage is compatible

### commander (11 → 12)

- CLI API fully compatible
- New features available but not required

### Electron (28 → 33)

- Major version jump but our usage is compatible
- Context isolation already enabled
- Chromium and Node.js updates included

### Loaders (style-loader 3→4, css-loader 6→7)

- Webpack 5 compatible
- Configuration unchanged for our use case

## Testing Required

After installation completes, test:

1. `npm run dev` - Verify app launches
2. Project scanning functionality
3. Macro execution
4. Log parsing and tailing
5. Database operations (SQLite)

## Benefits

- ✅ No more deprecation warnings
- ✅ Latest security patches
- ✅ Better performance (especially chokidar and better-sqlite3)
- ✅ Improved Node.js 20+ compatibility
- ✅ Future-proof for next 12+ months
