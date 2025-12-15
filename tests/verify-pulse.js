const path = require('path');
const Module = require('module');

// --- MOCKING START ---
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') {
    return { app: { getPath: () => '/tmp' } };
  }
  if (id.endsWith('ConfigService')) {
      return {
          get: (key) => {
              if (key === 'php.path') return 'php';
              return null;
          }
      };
  }
  return originalRequire.apply(this, arguments);
};
// --- MOCKING END ---

const PulseService = require('../src/services/PulseService');

// Mock dependencies if needed, or just run it given it's integration test style
// We'll try to run against a real path if possible, or just check system stats
const projectPath = path.resolve(__dirname, '../'); // Use own repo as dummy project path

async function verify() {
  console.log('Testing PulseService...');
  
  try {
    const stats = await PulseService.getStats(projectPath);
    console.log('Stats received:', JSON.stringify(stats, null, 2));
    
    // Validations
    if (typeof stats.system.cpu !== 'number') throw new Error('Missing CPU stats');
    if (typeof stats.system.memory.percent !== 'number') throw new Error('Missing Memory stats');
    if (!stats.phpFpm) throw new Error('Missing PHP-FPM stats');
    if (!stats.database) throw new Error('Missing Database stats'); // Might be error state but structure should exist
    
    console.log('✅ Verification Successful');
  } catch (error) {
    console.error('❌ Verification Failed:', error);
    process.exit(1);
  }
}

verify();
