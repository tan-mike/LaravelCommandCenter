const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize database connection and run schema
   */
  initialize() {
    if (this.initialized) return;

    // Use app data directory for database
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'devcontrol.db');

    // Create database connection
    this.db = new Database(dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);

    this.initialized = true;
    console.log(`Database initialized at: ${dbPath}`);
  }

  /**
   * Get database instance
   */
  getDB() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.db;
  }

  /**
   * Run a query
   */
  run(sql, params = []) {
    return this.getDB().prepare(sql).run(params);
  }

  /**
   * Get single row
   */
  get(sql, params = []) {
    return this.getDB().prepare(sql).get(params);
  }

  /**
   * Get all rows
   */
  all(sql, params = []) {
    return this.getDB().prepare(sql).all(params);
  }

  /**
   * Execute transaction
   */
  transaction(fn) {
    const db = this.getDB();
    return db.transaction(fn);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
    }
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
