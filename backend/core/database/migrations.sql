-- DormHive Database Migrations
-- Run these SQL commands to set up your database schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(255),
  role ENUM('tenant', 'owner', 'admin') DEFAULT 'tenant',
  status ENUM('active','suspended','pending','archived') DEFAULT 'active',
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  verification_document_id INT NULL,
  archived_status ENUM('active','suspended','pending') NULL,
  archived_at DATETIME NULL,
  last_login_at DATETIME NULL,
  last_active_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  municipality VARCHAR(100) NOT NULL,
  barangay VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  room_type VARCHAR(100) NOT NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  max_occupants INT NULL,
  total_slots INT NOT NULL DEFAULT 1,
  available_slots INT,
  gender_preference ENUM('co-ed', 'male', 'female'),
  amenities JSON,
  image_url VARCHAR(255),
  images JSON,
  ownership_document_id INT NULL,
  status ENUM('pending', 'approved', 'rejected', 'archived') DEFAULT 'pending',
  archived_status ENUM('pending', 'approved', 'rejected') NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_owner (owner_id),
  INDEX idx_municipality (municipality),
  INDEX idx_room_type (room_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  tenant_id INT NOT NULL,
  owner_id INT NOT NULL,
  move_in_date DATE,
  move_out_date DATE,
  is_indefinite_move_out TINYINT(1) NOT NULL DEFAULT 0,
  viewing_date DATE NULL,
  viewing_time TIME NULL,
  viewing_schedule_tenant_submitted TINYINT(1) NOT NULL DEFAULT 0,
  occupants INT NOT NULL DEFAULT 1,
  message TEXT,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_property (property_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  owner_id INT NOT NULL,
  property_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id),
  INDEX idx_owner (owner_id),
  INDEX idx_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  photo_batch_id CHAR(36) NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_id),
  INDEX idx_read (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_read (read_at),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  assigned_admin_id INT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('open', 'in-progress', 'resolved', 'closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_admin_id INT NULL AFTER user_id;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ticket_messages_ticket (ticket_id),
  INDEX idx_ticket_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add missing columns to properties table if they don't exist
-- Run these if you have an existing properties table without these columns:
ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_slots INT AFTER max_occupants;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_slots INT NULL AFTER max_occupants;
UPDATE properties SET total_slots = GREATEST(1, COALESCE(max_occupants, 1)) WHERE total_slots IS NULL;
ALTER TABLE properties MODIFY COLUMN total_slots INT NOT NULL DEFAULT 1;
ALTER TABLE properties MODIFY COLUMN max_occupants INT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gender_preference ENUM('co-ed', 'male', 'female') AFTER available_slots;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities JSON AFTER gender_preference;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS images JSON AFTER image_url;
ALTER TABLE properties MODIFY COLUMN room_type VARCHAR(100) NOT NULL;

-- Add first_name and last_name to users for separate name storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) AFTER name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) AFTER first_name;
ALTER TABLE users MODIFY COLUMN status ENUM('active','suspended','pending','archived') DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_document_id INT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_status ENUM('active','suspended','pending') NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at DATETIME NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ownership_document_id INT NULL;
UPDATE users SET last_active_at = last_login_at WHERE last_login_at IS NOT NULL AND last_active_at IS NULL;
ALTER TABLE properties MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'archived') DEFAULT 'pending';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_status ENUM('pending', 'approved', 'rejected') NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_indefinite_move_out TINYINT(1) NOT NULL DEFAULT 0 AFTER move_out_date;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occupants INT NOT NULL DEFAULT 1 AFTER viewing_schedule_tenant_submitted;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS viewing_schedule_tenant_submitted TINYINT(1) NOT NULL DEFAULT 0 AFTER viewing_time;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT AFTER title;

-- Persist all uploaded files in the database; properties.image_url/images remain URL references.
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500) NULL;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uploaded_by INT NOT NULL,
  user_id INT NULL,
  property_id INT NULL,
  message_id INT NULL,
  ticket_message_id INT NULL,
  is_private TINYINT(1) NOT NULL DEFAULT 0,
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

ALTER TABLE media_files ADD COLUMN IF NOT EXISTS is_private TINYINT(1) NOT NULL DEFAULT 0;
