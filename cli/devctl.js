#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const ProjectScanner = require('../src/services/ProjectScanner');
const MacroRunner = require('../src/services/MacroRunner');
const ArtisanBridge = require('../src/services/ArtisanBridge');
const LogParser = require('../src/services/LogParser');
const LogIndexer = require('../src/services/LogIndexer');
const db = require('../src/db/Database');

const program = new Command();

program
  .name('devctl')
  .description('Laravel Dev Control Center CLI')
  .version('1.0.0');

// Project scanning
program
  .command('project:scan')
  .description('Scan a Laravel project')
  .argument('<path>', 'Path to Laravel project')
  .option('--json', 'Output as JSON')
  .action(async (projectPath, options) => {
    try {
      // Initialize database
      db.initialize();

      const projectInfo = await ProjectScanner.scan(projectPath);
      
      if (options.json) {
        console.log(JSON.stringify(projectInfo, null, 2));
      } else {
        console.log(`\n📦 Project: ${projectInfo.name}`);
        console.log(`📍 Path: ${projectInfo.path}`);
        console.log(`🏷️  Laravel: ${projectInfo.laravel_version}`);
        console.log(`⚙️  Commands: ${projectInfo.artisan_commands.length}`);
        console.log(`📮 Queues: ${projectInfo.queues.join(', ')}`);
        
        if (projectInfo.packages.length > 0) {
          console.log(`\n📚 Packages:`);
          projectInfo.packages.forEach(pkg => {
            console.log(`   - ${pkg.name} (${pkg.version})`);
          });
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Macro execution
program
  .command('macro')
  .description('Run a macro')
  .argument('<name>', 'Macro name (clear-caches, rebuild-autoload, retry-failed-jobs, cache-config)')
  .option('--project <path>', 'Project path')
  .option('--dry-run', 'Show what would be executed without running')
  .option('--yes', 'Skip confirmation')
  .action(async (macroName, options) => {
    try {
      const projectPath = options.project || process.cwd();
      
      if (!options.yes && !options.dryRun) {
        console.log(`⚠️  Use --yes to confirm or --dry-run to preview`);
        process.exit(1);
      }

      const result = await MacroRunner.run(macroName, projectPath, {
        dryRun: options.dryRun
      });

      if (result.dryRun) {
        console.log(`\n🔍 DRY RUN - Commands that would be executed:`);
        result.commands.forEach(cmd => console.log(`   - ${cmd}`));
      } else {
        console.log(`\n⚡ Running macro: ${result.macro}`);
        result.results.forEach(r => {
          const icon = r.success ? '✓' : '✗';
          console.log(`${icon} ${r.command}`);
          if (r.error) {
            console.error(`  Error: ${r.error}`);
          }
        });
        
        if (result.success) {
          console.log(`\n✓ Macro completed successfully`);
        } else {
          console.log(`\n✗ Macro completed with errors`);
          process.exit(1);
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Artisan command execution
program
  .command('artisan')
  .description('Execute an artisan command')
  .argument('<command>', 'Artisan command')
  .option('--project <path>', 'Project path')
  .action(async (command, options) => {
    try {
      const projectPath = options.project || process.cwd();
      
      const result = await ArtisanBridge.execute(projectPath, command);
      
      if (result.success) {
        console.log(result.output);
        process.exit(0);
      } else {
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Route commands
program
  .command('route:list')
  .description('List routes')
  .option('--project <path>', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const projectPath = options.project || process.cwd();
      const routes = await ArtisanBridge.getRoutes(projectPath);
      
      if (options.json) {
        console.log(JSON.stringify(routes, null, 2));
      } else {
        console.log(`\n🛣️  Routes:\n`);
        routes.forEach(route => {
          console.log(`${route.method.padEnd(10)} ${route.uri.padEnd(40)} ${route.action}`);
        });
      }
      
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Log commands
program
  .command('logs:index')
  .description('Index log file')
  .argument('<logfile>', 'Path to log file')
  .option('--project <path>', 'Project path')
  .action(async (logFile, options) => {
    try {
      db.initialize();
      
      const projectPath = options.project || process.cwd();
      
      // Get or create project
      let project = db.get('SELECT id FROM projects WHERE path = ?', [projectPath]);
      if (!project) {
        const projectInfo = await ProjectScanner.scan(projectPath);
        const result = db.run(
          'INSERT INTO projects (path, name, last_scan_at) VALUES (?, ?, datetime("now"))',
          [projectPath, projectInfo.name]
        );
        project = { id: result.lastInsertRowid };
      }

      // Parse and index log file
      const fs = require('fs');
      const content = fs.readFileSync(logFile, 'utf8');
      const entries = LogParser.parse(content);
      const stats = LogIndexer.index(project.id, entries);

      console.log(`\n📊 Log Indexing Complete:`);
      console.log(`   Total entries: ${stats.total}`);
      console.log(`   New errors: ${stats.new}`);
      console.log(`   Updated errors: ${stats.updated}`);
      
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
