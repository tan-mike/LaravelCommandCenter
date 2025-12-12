const ArtisanBridge = require('./ArtisanBridge');
const fs = require('fs');
const path = require('path');

class DatabaseService {
  async getMigrations(projectPath) {
    try {
      const { output } = await ArtisanBridge.execute(projectPath, 'migrate:status');
      if (!output) return [];

      // Parse output
      const lines = output.split('\n');
      const migrations = [];
      
      lines.forEach(line => {
        const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, '').trim();
        if (!cleanLine) return;

        // Format 1: Table style "| Ran? | Migration | Batch |"
        if (cleanLine.includes('|')) {
            const parts = cleanLine.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const status = parts[0].toLowerCase();
                if (status === 'yes' || status === 'no') {
                    const name = parts[1];
                    const batch = parts[2] || '';
                    migrations.push({ name, ran: status === 'yes', batch });
                }
            }
            return;
        }

        // Format 2: Dot-leader style "Title ...... [1] Ran" or "Title ...... Pending"
        // Regex: (Name) (dots) ([Batch]?) (Status)
        const dotMatch = cleanLine.match(/^(.*?)\s*\.{2,}\s*(?:\[(\d+)\])?\s*(Ran|Pending)/i);
        if (dotMatch) {
            const name = dotMatch[1].trim();
            const batch = dotMatch[2] || '';
            const statusStr = dotMatch[3].toLowerCase();
            const ran = statusStr === 'ran';
            migrations.push({ name, ran, batch });
        }
      });

      return migrations.reverse(); // Show newest first
    } catch (e) {
      console.error('Migration status error:', e);
      return [];
    }
  }

  async runMigrate(projectPath) {
    try {
        const { success, output, error } = await ArtisanBridge.execute(projectPath, 'migrate --force');
        return { success, output, error };
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  async rollback(projectPath, steps = 1) {
    try {
        const cmd = `migrate:rollback --step=${steps} --force`;
        const { success, output, error } = await ArtisanBridge.execute(projectPath, cmd);
        return { success, output, error };
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  async reset(projectPath) {
    try {
        const { success, output, error } = await ArtisanBridge.execute(projectPath, 'migrate:reset --force');
        return { success, output, error };
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  async refresh(projectPath) {
    try {
        const { success, output, error } = await ArtisanBridge.execute(projectPath, 'migrate:refresh --force');
        return { success, output, error };
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  async getEnvironment(projectPath) {
      try {
          const envPath = path.join(projectPath, '.env');
          if (fs.existsSync(envPath)) {
              const content = fs.readFileSync(envPath, 'utf8');
              const match = content.match(/^APP_ENV=(.*)$/m);
              if (match) {
                  return match[1].trim();
              }
          }
          return 'production'; // Default to safe assumption if missing
      } catch (e) {
          return 'unknown';
      }
  }
}

module.exports = new DatabaseService();
