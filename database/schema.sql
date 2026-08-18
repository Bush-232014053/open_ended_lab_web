-- P2P Campus Tool & Equipment Library
-- CSE 3120 Open Ended Lab — MySQL schema

CREATE DATABASE IF NOT EXISTS campus_library
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus_library;

DROP TABLE IF EXISTS borrow_requests;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'staff') NOT NULL DEFAULT 'student',
  campus_id VARCHAR(40) NOT NULL,
  department VARCHAR(80) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('tools', 'electronics', 'textbooks', 'lab-kits', 'cameras', 'other')
    NOT NULL DEFAULT 'other',
  condition_note ENUM('new', 'like-new', 'good', 'fair') NOT NULL DEFAULT 'good',
  location VARCHAR(120) NOT NULL,
  status ENUM('available', 'pending', 'borrowed') NOT NULL DEFAULT 'available',
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE borrow_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  borrower_id INT NOT NULL,
  message VARCHAR(400),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'returned', 'cancelled')
    NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_requests_status ON borrow_requests(status);
