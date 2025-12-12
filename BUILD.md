# Build Instructions

## Prerequisites

- Node.js (v16 or higher)
- NPM

## Windows Build

To build the Windows installer (`.exe`):

```bash
npm run build:win
```

_Output: `dist/Laravel Dev Control Center Setup 1.0.0.exe`_

## Mac Build

**Note**: You must run this compiled on macOS to correctly sign and notarize the application, or to compile native modules (`better-sqlite3`).

```bash
npm run build:mac
```

_Output: `dist/Laravel Dev Control Center-1.0.0.dmg`_

### Native Modules Warning

Since we use `better-sqlite3`, you cannot easily build the Mac version from Windows. The native bindings must be compiled for the target architecture (Darwin).

**Recommended**: Use GitHub Actions to build for Mac.

## Linux Build

**Note**: Must be built on Linux or via Docker/CI for native module compatibility.

```bash
npm run build:linux
```

_Output: `dist/Laravel Dev Control Center-1.0.0.AppImage`_

## Troubleshooting

### Build Failed: winCodeSign / NSIS download error

If you are in a region with restricted internet (e.g., China), `electron-builder` may fail to download required tools.
Try setting the binary mirror before building:

**PowerShell**:

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"; npm run build:win
```

**CMD**:

```cmd
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ && npm run build:win
```

## CI/CD (GitHub Actions)

Create `.github/workflows/build.yml` to automate multi-platform builds:

```yaml
name: Build/Release
on: [push]
jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
