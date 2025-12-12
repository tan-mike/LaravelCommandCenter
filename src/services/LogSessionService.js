const fs = require('fs');
const readline = require('readline');
const db = require('../db/Database');
const LogParser = require('./LogParser');

class LogSessionService {
  /**
   * Import a log file into the database
   * @param {string} filePath
   * @returns {Promise<number>} sessionId
   */
  async importLog(filePath) {
    // Create session
    const stats = fs.statSync(filePath);
    const filename = filePath.split(/[\\/]/).pop();
    
    const result = db.run(
      'INSERT INTO log_sessions (filename, file_size) VALUES (?, ?)',
      [filename, stats.size]
    );
    const sessionId = result.lastInsertRowid;

    // Stream and parse
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    let currentEntry = null;
    let entries = [];
    let totalEntries = 0;
    const BATCH_SIZE = 1000;

    const processBatch = () => {
      if (entries.length === 0) return;
      
      const insert = db.getDB().prepare(`
        INSERT INTO log_entries (
          session_id, timestamp, environment, level, message, 
          context, raw_content, line_number
        ) VALUES (
          @session_id, @timestamp, @environment, @level, @message,
          @context, @raw_content, @line_number
        )
      `);

      const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(row);
      });

      insertMany(entries);
      totalEntries += entries.length;
      entries = [];
    };

    let lineNumber = 0;
    
    try {
        for await (const line of rl) {
            lineNumber++;
            const parsed = LogParser.parseLine(line, currentEntry);
            
            if (parsed) {
                if (parsed.isNew) {
                    if (currentEntry) {
                        const finalized = LogParser.finalizeEntry(currentEntry);
                        entries.push(this.transformEntry(sessionId, finalized, lineNumber));
                        
                        if (entries.length >= BATCH_SIZE) {
                            processBatch();
                            // Optional: Yield to event loop
                            await new Promise(resolve => setImmediate(resolve));
                        }
                    }
                    currentEntry = parsed.entry;
                } else {
                    currentEntry = parsed.entry;
                }
            }
        }

        // Final entry
        if (currentEntry) {
            const finalized = LogParser.finalizeEntry(currentEntry);
            entries.push(this.transformEntry(sessionId, finalized, lineNumber));
        }

        // Final batch
        processBatch();

        // Update session stats
        db.run(
            'UPDATE log_sessions SET total_entries = ? WHERE id = ?',
            [totalEntries, sessionId]
        );

        return { success: true, sessionId, totalEntries };
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
  }

  transformEntry(sessionId, entry, lineNumber) {
    return {
        session_id: sessionId,
        timestamp: entry.timestamp.toISOString(),
        environment: entry.environment,
        level: entry.level,
        message: entry.message,
        context: JSON.stringify({
            exception: entry.exception,
            stackTrace: entry.stackTrace,
            fingerprint: entry.fingerprint,
            title: entry.title
        }),
        raw_content: entry.rawLines.join('\n'),
        line_number: lineNumber // Approximate end line
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const counts = db.all(
        `SELECT level, COUNT(*) as count 
         FROM log_entries 
         WHERE session_id = ? 
         GROUP BY level`,
        [sessionId]
    );

    const stats = {
        total: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        debug: 0
    };

    counts.forEach(row => {
        stats.total += row.count;
        const level = row.level.toUpperCase();
        if (['ERROR', 'CRITICAL', 'EMERGENCY', 'ALERT'].includes(level)) stats.errors += row.count;
        else if (level === 'WARNING') stats.warnings += row.count;
        else if (level === 'INFO') stats.info += row.count;
        else if (level === 'DEBUG') stats.debug += row.count;
    });

    return stats;
  }

  /**
   * Get entries with pagination and filtering
   */
  getEntries(sessionId, options = {}) {
    const {
        page = 1,
        limit = 50,
        level = null, // 'errors', 'warnings', etc or specific level
        search = ''
    } = options;

    const offset = (page - 1) * limit;
    const params = { session_id: sessionId };
    let query = 'SELECT * FROM log_entries WHERE session_id = @session_id';

    if (level) {
        if (level === 'errors') {
            query += " AND level IN ('ERROR', 'CRITICAL', 'EMERGENCY', 'ALERT')";
        } else if (level === 'warnings') {
            query += " AND level = 'WARNING'";
        } else if (level === 'info') {
            query += " AND level = 'INFO'";
        } else if (level === 'debug') {
            query += " AND level = 'DEBUG'";
        }
    }

    if (search) {
        query += " AND (message LIKE @search OR raw_content LIKE @search)";
        params.search = `%${search}%`;
    }

    // Count total for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalResult = db.get(countQuery, params); // db.get uses db.prepare logic

    // Fetch data
    query += ' ORDER BY id ASC LIMIT @limit OFFSET @offset'; // Original order
    params.limit = limit;
    params.offset = offset;

    // db.all implementation in Database.js expects (sql, paramsArray) usually, 
    // but better-sqlite3 supports named parameters if we use db.prepare().all(namedParams).
    // Let's verify Database.js wrapper.
    // Database.js: return this.getDB().prepare(sql).all(params);
    // So yes, it supports named parameters if passed as object.

    const entries = db.getDB().prepare(query).all(params);

    return {
        data: entries.map(e => ({
            ...e,
            context: JSON.parse(e.context || '{}')
        })),
        meta: {
            total: totalResult.total,
            page,
            limit,
            last_page: Math.ceil(totalResult.total / limit)
        }
    };
  }
}

module.exports = new LogSessionService();
