-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.4.32-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.21.0.7344
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table dormhive_restore.bookings
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `property_id` bigint(20) unsigned NOT NULL,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `move_in_date` date NOT NULL,
  `move_out_date` date DEFAULT NULL,
  `occupants` smallint(5) unsigned NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('pending','approved','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_bookings_tenant` (`tenant_id`,`created_at`),
  KEY `idx_bookings_property` (`property_id`,`status`),
  CONSTRAINT `fk_bookings_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table dormhive_restore.bookings: ~0 rows (approximately)

-- Dumping structure for table dormhive_restore.conversations
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `owner_id` bigint(20) unsigned NOT NULL,
  `property_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_participants` (`tenant_id`,`owner_id`,`property_id`),
  KEY `fk_conversations_owner` (`owner_id`),
  KEY `fk_conversations_property` (`property_id`),
  CONSTRAINT `fk_conversations_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_conversations_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_conversations_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table dormhive_restore.conversations: ~1 rows (approximately)
INSERT INTO `conversations` (`id`, `tenant_id`, `owner_id`, `property_id`, `created_at`, `updated_at`) VALUES
	(19, 41, 40, NULL, '2026-09-03 09:13:23', '2026-09-03 09:13:23');

-- Dumping structure for table dormhive_restore.messages
CREATE TABLE IF NOT EXISTS `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint(20) unsigned NOT NULL,
  `sender_id` bigint(20) unsigned NOT NULL,
  `body` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_messages_sender` (`sender_id`),
  KEY `idx_messages_conversation` (`conversation_id`,`created_at`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table dormhive_restore.messages: ~1 rows (approximately)
INSERT INTO `messages` (`id`, `conversation_id`, `sender_id`, `body`, `read_at`, `created_at`) VALUES
	(44, 19, 41, 'hello available paba to?', '2026-09-04 23:13:47', '2026-09-03 09:13:23');

-- Dumping structure for table dormhive_restore.notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `type` varchar(80) NOT NULL,
  `title` varchar(160) NOT NULL,
  `message` text DEFAULT NULL,
  `body` varchar(500) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` bigint(20) unsigned DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`,`read_at`,`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table dormhive_restore.notifications: ~2 rows (approximately)
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `body`, `reference_type`, `reference_id`, `read_at`, `created_at`) VALUES
	(14, 40, '', 'Property approved', 'Your listing "101" has been approved and is now live for tenants to browse.', NULL, NULL, NULL, '2026-09-06 22:46:51', '2026-09-06 01:35:36'),
	(15, 40, '', 'Property rejected', 'Your listing "432432" has been rejected and will remain hidden from tenants.', NULL, NULL, NULL, '2026-09-06 22:46:50', '2026-09-06 01:37:00');

-- Dumping structure for table dormhive_restore.properties
CREATE TABLE IF NOT EXISTS `properties` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` text DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `municipality` varchar(120) NOT NULL,
  `barangay` varchar(120) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `room_type` enum('bedspace','private_room','entire_unit') NOT NULL,
  `monthly_rent` decimal(12,2) NOT NULL,
  `max_occupants` smallint(5) unsigned NOT NULL,
  `available_slots` int(11) DEFAULT NULL,
  `gender_preference` enum('co-ed','male','female') DEFAULT NULL,
  `amenities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`amenities`)),
  `image_url` varchar(500) DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `status` enum('pending','approved','rejected','archived') NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_properties_search` (`status`,`municipality`,`room_type`,`monthly_rent`),
  KEY `idx_properties_owner` (`owner_id`),
  CONSTRAINT `fk_properties_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table dormhive_restore.properties: ~4 rows (approximately)
INSERT INTO `properties` (`id`, `owner_id`, `title`, `description`, `address`, `municipality`, `barangay`, `latitude`, `longitude`, `room_type`, `monthly_rent`, `max_occupants`, `available_slots`, `gender_preference`, `amenities`, `image_url`, `images`, `status`, `rejection_reason`, `created_at`, `updated_at`) VALUES
	(49, 40, '101', 'cool', 'Philippine Army Officers\' Village, Pinagsama, Taguig District 2, Taguig, Southern Manila District, Metro Manila, 1648, Philippines', 'Taguig', 'Pinagsama', 14.5283963, 121.0493414, 'entire_unit', 787878.00, 1, 1, 'co-ed', '["aircon","dishwasher"]', '/uploads/properties/1788427710273-house.jpg', '["/uploads/properties/1788427710273-house.jpg","/uploads/properties/1788427710283-house2112---Copy.jpg","/uploads/properties/1788427710278-house2222.jpg","/uploads/properties/1788427710284-house2222221---Copy.jpg"]', 'approved', NULL, '2026-09-03 09:28:36', '2026-09-06 01:35:36'),
	(50, 40, '432432', 'besa', 'Evangelista Street', 'Taguig', 'Western Bicutan', 14.5285401, 121.0400763, 'entire_unit', 432423.00, 4234, 43242, 'co-ed', '["aircon","pets_allowed","dishwasher"]', '/uploads/properties/1788427752220-house.jpg', '["/uploads/properties/1788427752220-house.jpg","/uploads/properties/1788427752227-house2112---Copy.jpg","/uploads/properties/1788427752229-house2222.jpg","/uploads/properties/1788427752230-images.jpg"]', 'rejected', NULL, '2026-09-03 09:29:20', '2026-09-06 01:37:00'),
	(51, 40, 'hotles', 'shes', 'Osmeña Highway', 'Makati', 'San Isidro', 14.5565335, 121.0074060, 'entire_unit', 122112.00, 1, 1, 'co-ed', '["pets_allowed","cable_ready"]', '/uploads/properties/1788427790423-house2222221.jpg', '["/uploads/properties/1788427790423-house2222221.jpg","/uploads/properties/1788427790428-housesssssss.jpg","/uploads/properties/1788427790413-images--1-12.jpg","/uploads/properties/1788427790425-images.jpg","/uploads/properties/1788427790438-imagessss.jpg"]', 'approved', NULL, '2026-09-03 09:29:59', '2026-09-05 02:40:35'),
	(52, 40, 'sdsawd', 'cool house\r\n', 'C-6 Extension bike lane Purok 8', 'Taytay', 'Santa Ana', 14.5321804, 121.1085809, 'private_room', 321321.00, 3213, 321312, 'co-ed', '["kitchen","aircon","pets_allowed"]', '/uploads/properties/1788577394530-house2222---Copy.jpg', '["/uploads/properties/1788577394530-house2222---Copy.jpg","/uploads/properties/1788577394542-house2222.jpg","/uploads/properties/1788577394547-images--1-12.jpg","/uploads/properties/1788577394559-images.jpg","/uploads/properties/1788577394562-house2112.jpg"]', 'pending', NULL, '2026-09-05 03:03:20', '2026-09-05 03:03:20');

-- Dumping structure for table dormhive_restore.property_images
CREATE TABLE IF NOT EXISTS `property_images` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `property_id` bigint(20) unsigned NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_property_images_order` (`property_id`,`sort_order`),
  CONSTRAINT `fk_property_images_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table dormhive_restore.property_images: ~0 rows (approximately)

-- Dumping structure for table dormhive_restore.support_tickets
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `requester_id` bigint(20) unsigned NOT NULL,
  `subject` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `assigned_admin_id` bigint(20) unsigned DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_tickets_requester` (`requester_id`),
  KEY `fk_tickets_admin` (`assigned_admin_id`),
  KEY `idx_tickets_status` (`status`,`priority`,`created_at`),
  CONSTRAINT `fk_tickets_admin` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_requester` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table dormhive_restore.support_tickets: ~16 rows (approximately)
INSERT INTO `support_tickets` (`id`, `requester_id`, `subject`, `description`, `priority`, `status`, `assigned_admin_id`, `resolved_at`, `created_at`, `updated_at`) VALUES
	(1, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:22', '2026-09-06 06:44:22'),
	(2, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:23', '2026-09-06 06:44:23'),
	(3, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:23', '2026-09-06 06:44:23'),
	(4, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:23', '2026-09-06 06:44:23'),
	(5, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:25', '2026-09-06 06:44:25'),
	(6, 40, 'dsad', 'dsad', 'high', 'open', NULL, NULL, '2026-09-06 06:44:25', '2026-09-06 06:44:25'),
	(7, 41, 'wala naman', '...', 'high', 'open', NULL, NULL, '2026-09-06 14:00:18', '2026-09-06 14:00:18'),
	(8, 41, 'trip ko lang mag report', 'wala talaga ng yare', 'high', 'open', NULL, NULL, '2026-09-06 14:13:16', '2026-09-06 14:13:16'),
	(9, 40, 'hllo gs da', 'wasdsada', 'medium', 'open', NULL, NULL, '2026-09-06 15:27:05', '2026-09-06 15:27:05'),
	(10, 40, 'dsadsa', 'dsadsadsad', 'high', 'open', NULL, NULL, '2026-09-06 15:27:25', '2026-09-06 15:27:25'),
	(11, 40, 'dsadsa', 'dsadsadsad', 'high', 'open', NULL, NULL, '2026-09-06 15:29:37', '2026-09-06 15:29:37'),
	(12, 40, 'fdsf', 'fdsfds', 'high', 'open', NULL, NULL, '2026-09-06 15:29:45', '2026-09-06 15:29:45'),
	(13, 40, 'wahhshdhhadwsappppp', 'hellooosdasdas', 'medium', 'open', NULL, NULL, '2026-09-06 15:30:41', '2026-09-06 15:30:41'),
	(14, 40, 'wahhshdhhadwsappppp', 'hellooosdasdas', 'medium', 'open', NULL, NULL, '2026-09-06 15:31:20', '2026-09-06 15:31:20'),
	(15, 40, 'sssssssssssssssssssssssssssssssssss', 'ssssssssssssssssssssssssssss', 'medium', 'open', NULL, NULL, '2026-09-06 15:31:50', '2026-09-06 15:31:50'),
	(16, 40, 'sdsadsadsa', 'dsadasdadda', 'medium', 'open', NULL, NULL, '2026-09-06 22:07:27', '2026-09-06 22:07:27');

-- Dumping structure for table dormhive_restore.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('tenant','owner','admin') NOT NULL,
  `status` enum('active','suspended','pending') NOT NULL DEFAULT 'active',
  `phone` varchar(30) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `auth_provider` varchar(20) DEFAULT NULL,
  `auth_provider_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table dormhive_restore.users: ~4 rows (approximately)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `phone`, `avatar_url`, `created_at`, `updated_at`, `first_name`, `last_name`, `auth_provider`, `auth_provider_id`) VALUES
	(7, 'juan luna', 'admin@admin.com', '$2b$12$dQ886ayZ0IL.xPcTM7xdyu68fEsX.4BI6kBYfUm7SI.bmqoENW1rW', 'admin', 'active', '09194808174', '/uploads/users/admin/1788660458097-Pia-Cayetano.jpg', '2026-07-31 09:28:46', '2026-09-06 15:01:59', 'juan', 'luna', NULL, NULL),
	(40, 'Jose cayetano', 'owner@owner.com', '$2b$12$gm9uN7FDe2ieE6KNzpgxnu/ZVr.6kgopf191ROibjzWRRf5WIuu8a', 'owner', 'active', '+639947891234', '/uploads/users/owner/1788362666498-Lito-Lapid.jpg', '2026-09-02 15:23:37', '2026-09-02 15:24:26', 'Jose', 'cayetano', NULL, NULL),
	(41, 'robin wall', 'tenant@tenant.com', '$2b$12$eXihQNMWyKAiDgd.QAP2YeVhPFnrv92qzrlCnavtoemoi3JFy9phy', 'tenant', 'active', '+639947891232', '/uploads/users/tenant/1788363710590-Robin-Padilla.jpg', '2026-09-02 15:39:23', '2026-09-02 15:41:50', 'robin', 'wall', NULL, NULL),
	(58, 'Miguel cruz', 'tenant@tenant2.com', '$2b$12$ocTn5mBKjAbxOtxDPHM71eXKe9sy5r/NtTYtWSwJXEMnN8FiMrST6', 'tenant', 'active', '+639974587865', '/uploads/users/tenant/1788412317715-Rodante-Marcoleta.jpg', '2026-09-03 05:11:29', '2026-09-03 05:11:57', 'Miguel', 'cruz', NULL, NULL);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
