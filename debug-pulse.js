const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to run command
function run(cmd) {
    return new Promise((resolve) => {
        console.log(`\n--- Running: ${cmd} ---`);
        exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
            if (error) console.log('Error:', error.message);
            if (stderr) console.log('Stderr:', stderr);
            console.log('Stdout:', stdout.trim());
            console.log('------------------------------');
            resolve(stdout);
        });
    });
}

async function debug() {
    console.log('Debugging Pulse Service Environment...');
    console.log('Platform:', os.platform());
    console.log('CWD:', process.cwd());

    // 1. Check PHP Version/Path
    await run('php -v');
    await run('which php');

    // 2. Check PHP-FPM
    console.log('\nChecking PHP-FPM...');
    // Try the exact command from PulseService
    await run('ps -A | grep -i "php-fpm" | grep -v grep | wc -l');
    // Try raw ps to see what's actually running
    await run('ps -A | grep -i "php-fpm" | head -n 5');

    // 3. Test DB Script logic
    // We'll create the script in the current directory (assuming it's a valid Laravel root or just to test execution)
    // NOTE: This test might fail if CWD is not a Laravel project. 
    // We will verify if we can at least execute a basic PHP script.
    
    const scriptPath = path.join(process.cwd(), '_debug_test.php');
    const phpCode = `<?php
    echo "PHP is working. Time: " . time();
    ?>`;
    fs.writeFileSync(scriptPath, phpCode);
    
    console.log('\nChecking PHP Execution...');
    await run(`php "${scriptPath}"`);
    
    try { fs.unlinkSync(scriptPath); } catch(e) {}
}

debug();
