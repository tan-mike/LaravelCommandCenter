-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_scan_at DATETIME,
  config TEXT -- JSON config
);

-- Errors/logs table
CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  fingerprint TEXT NOT NULL,
  title TEXT,
  message TEXT,
  sample_trace TEXT, -- JSON
  count INTEGER DEFAULT 1,
  first_seen DATETIME,
  last_seen DATETIME,
  status TEXT DEFAULT 'open', -- open/assigned/resolved
  tags TEXT, -- JSON array
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Macros execution history
CREATE TABLE IF NOT EXISTS macros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT NOT NULL,
  script TEXT,
  last_run_at DATETIME,
  run_count INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- API playbooks
CREATE TABLE IF NOT EXISTS playbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT NOT NULL,
  method TEXT,
  path TEXT,
  payload TEXT, -- JSON
  created_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Code smells
CREATE TABLE IF NOT EXISTS smells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  rule TEXT,
  file TEXT,
  line INTEGER,
  severity TEXT, -- info/warning/critical
  notes TEXT,
  detected_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  action TEXT,
  details TEXT, -- JSON
  actor TEXT, -- OS username
  created_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_errors_fingerprint ON errors(fingerprint);
CREATE INDEX IF NOT EXISTS idx_errors_project ON errors(project_id);
CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_smells_project ON smells(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project_id);

-- Log Import Sessions
CREATE TABLE IF NOT EXISTS log_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_entries INTEGER DEFAULT 0
);

-- Log Entries for specific session
CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  timestamp DATETIME,
  environment TEXT,
  level TEXT,
  message TEXT,
  context TEXT,
  raw_content TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES log_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_log_entries_session ON log_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);

