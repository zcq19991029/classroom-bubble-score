CREATE TABLE teacher_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  category TEXT NOT NULL CHECK(category IN ('问题反馈','功能建议')),
  content TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '待处理' CHECK(status IN ('待处理','处理中','已解决')),
  reply TEXT NOT NULL DEFAULT '',
  admin_unread INTEGER NOT NULL DEFAULT 1,
  teacher_unread INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX feedback_teacher_time_idx ON teacher_feedback(teacher_id, created_at);
