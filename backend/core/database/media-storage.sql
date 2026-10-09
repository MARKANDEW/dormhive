-- Run after the existing DormHive schema migration. Safe to apply more than once.
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  attachment_url VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ticket_messages_ticket (ticket_id),
  INDEX idx_ticket_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500) NULL;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uploaded_by INT NOT NULL,
  user_id INT NULL,
  property_id INT NULL,
  message_id INT NULL,
  ticket_message_id INT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(127) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  file_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_message_id) REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  INDEX idx_media_uploaded_by (uploaded_by),
  INDEX idx_media_user (user_id),
  INDEX idx_media_property (property_id),
  INDEX idx_media_message (message_id),
  INDEX idx_media_ticket_message (ticket_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
