const db = require('../db/Database');

class LogIndexer {
  /**
   * Index parsed log entries into database
   * @param {number} projectId - Project ID
   * @param {Array} entries - Parsed log entries
   * @returns {Object} Indexing statistics
   */
  static index(projectId, entries) {
    const stats = {
      total: entries.length,
      new: 0,
      updated: 0
    };

    const transaction = db.transaction(() => {
      entries.forEach(entry => {
        if (entry.level === 'ERROR' || entry.level === 'CRITICAL' || entry.level === 'EMERGENCY') {
          const result = this.indexError(projectId, entry);
          if (result.isNew) {
            stats.new++;
          } else {
            stats.updated++;
          }
        }
      });
    });

    transaction();

    return stats;
  }

  /**
   * Index a single error entry
   */
  static indexError(projectId, entry) {
    // Check if error with this fingerprint already exists
    const existing = db.get(
      'SELECT * FROM errors WHERE project_id = ? AND fingerprint = ?',
      [projectId, entry.fingerprint]
    );

    if (existing) {
      // Update existing error
      db.run(
        `UPDATE errors 
         SET count = count + 1,
             last_seen = ?,
             sample_trace = ?
         WHERE id = ?`,
        [
          entry.timestamp.toISOString(),
          JSON.stringify(entry.stackTrace),
          existing.id
        ]
      );

      return { isNew: false, id: existing.id };
    } else {
      // Insert new error
      const result = db.run(
        `INSERT INTO errors (
          project_id, fingerprint, title, message, sample_trace,
          count, first_seen, last_seen, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          entry.fingerprint,
          entry.title,
          entry.message,
          JSON.stringify(entry.stackTrace),
          1,
          entry.timestamp.toISOString(),
          entry.timestamp.toISOString(),
          'open'
        ]
      );

      return { isNew: true, id: result.lastInsertRowid };
    }
  }

  /**
   * Get grouped errors for a project
   */
  static getGroupedErrors(projectId, options = {}) {
    const {
      status = null,
      limit = 100,
      offset = 0
    } = options;

    let query = `
      SELECT id, fingerprint, title, message, count,
             first_seen, last_seen, status, tags
      FROM errors
      WHERE project_id = ?
    `;
    const params = [projectId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.all(query, params);
  }

  /**
   * Get error detail by ID
   */
  static getErrorDetail(errorId) {
    const error = db.get('SELECT * FROM errors WHERE id = ?', [errorId]);
    
    if (error && error.sample_trace) {
      error.sample_trace = JSON.parse(error.sample_trace);
    }
    
    if (error && error.tags) {
      error.tags = JSON.parse(error.tags);
    }

    return error;
  }

  /**
   * Update error status
   */
  static updateErrorStatus(errorId, status) {
    db.run(
      'UPDATE errors SET status = ? WHERE id = ?',
      [status, errorId]
    );
  }

  /**
   * Add tag to error
   */
  static addTag(errorId, tag) {
    const error = db.get('SELECT tags FROM errors WHERE id = ?', [errorId]);
    
    let tags = [];
    if (error && error.tags) {
      tags = JSON.parse(error.tags);
    }

    if (!tags.includes(tag)) {
      tags.push(tag);
      db.run(
        'UPDATE errors SET tags = ? WHERE id = ?',
        [JSON.stringify(tags), errorId]
      );
    }
  }

  /**
   * Get error statistics for a project
   */
  static getStats(projectId) {
    const stats = db.get(
      `SELECT 
         COUNT(*) as total_errors,
         SUM(count) as total_occurrences,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_errors
       FROM errors
       WHERE project_id = ?`,
      [projectId]
    );

    return stats;
  }

  /**
   * Detect error spikes (errors that increased significantly)
   */
  static detectSpikes(projectId, thresholdMultiplier = 3) {
    // Get errors that occurred in last hour vs previous hour
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

    const recentErrors = db.all(
      `SELECT fingerprint, COUNT(*) as recent_count
       FROM errors
       WHERE project_id = ? AND last_seen > ?
       GROUP BY fingerprint`,
      [projectId, oneHourAgo.toISOString()]
    );

    const previousErrors = db.all(
      `SELECT fingerprint, COUNT(*) as previous_count
       FROM errors
       WHERE project_id = ? AND last_seen BETWEEN ? AND ?
       GROUP BY fingerprint`,
      [projectId, twoHoursAgo.toISOString(), oneHourAgo.toISOString()]
    );

    const previousMap = {};
    previousErrors.forEach(e => {
      previousMap[e.fingerprint] = e.previous_count;
    });

    const spikes = [];
    recentErrors.forEach(e => {
      const previousCount = previousMap[e.fingerprint] || 0;
      if (e.recent_count > previousCount * thresholdMultiplier && previousCount > 0) {
        spikes.push({
          fingerprint: e.fingerprint,
          recent_count: e.recent_count,
          previous_count: previousCount,
          multiplier: e.recent_count / previousCount
        });
      }
    });

    return spikes;
  }
}

module.exports = LogIndexer;
