CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY NOT NULL,
  employee_no TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '教师',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_teacher_idx ON sessions(teacher_id);
CREATE TABLE IF NOT EXISTS workspaces (
  teacher_id TEXT PRIMARY KEY NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  payload_version INTEGER NOT NULL DEFAULT 2,
  source TEXT NOT NULL DEFAULT 'sites-d1',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_audit (
  id TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  classes_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  logs_count INTEGER NOT NULL DEFAULT 0,
  payload_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS migration_audit_teacher_idx ON migration_audit(teacher_id, created_at);
