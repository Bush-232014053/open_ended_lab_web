const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

function dbConfig(includeDatabase) {
  const config = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10
  };

  if (includeDatabase) {
    config.database = process.env.DB_NAME || "campus_library";
  }

  if (process.env.DB_SSL === "true") {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

async function waitForMysql(retries = 20) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await mysql.createConnection(dbConfig());
      await conn.query("SELECT 1");
      await conn.end();
      return;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function initDatabase() {
  await waitForMysql();

  const dbName = process.env.DB_NAME || "campus_library";
  const root = await mysql.createConnection(dbConfig(false));
  try {
    await root.query(
      "CREATE DATABASE IF NOT EXISTS `" +
        dbName.replace(/`/g, "") +
        "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
  } catch (err) {
    console.log("Could not create database (ok on hosted MySQL):", err.message);
  }
  await root.end();

  const pool = mysql.createPool(dbConfig(true));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('student', 'staff') NOT NULL DEFAULT 'student',
      campus_id VARCHAR(40) NOT NULL,
      department VARCHAR(80) NOT NULL,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS borrow_requests (
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
    )
  `);

  await seedIfEmpty(pool);
  return pool;
}

async function seedIfEmpty(pool) {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM users");
  if (rows[0].total > 0) return;

  const studentHash = await bcrypt.hash("Student123", 10);
  const staffHash = await bcrypt.hash("Staff123", 10);

  const [student] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, campus_id, department, phone)
     VALUES (?, ?, ?, 'student', ?, ?, ?)`,
    [
      "Ayesha Rahman",
      "student@ulab.edu.bd",
      studentHash,
      "202312345",
      "Computer Science & Engineering",
      "01700000001"
    ]
  );

  const [staff] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, campus_id, department, phone)
     VALUES (?, ?, ?, 'staff', ?, ?, ?)`,
    [
      "Dr. Nadia Hasan",
      "staff@ulab.edu.bd",
      staffHash,
      "FAC-088",
      "Computer Science & Engineering",
      "01700000002"
    ]
  );

  const demoItems = [
    [
      staff.insertId,
      "Arduino Starter Kit",
      "Arduino Uno kit with breadboard, jumper wires and some sensors. I used it for IoT lab last semester.",
      "lab-kits",
      "like-new",
      "Campus A, Faculty room",
      "/images/arduino.svg"
    ],
    [
      staff.insertId,
      "Canon DSLR Camera",
      "Canon camera with 18-55mm lens. Can be borrowed for club events or project photos.",
      "cameras",
      "good",
      "Media Lab",
      "/images/camera.svg"
    ],
    [
      student.insertId,
      "Digital Multimeter",
      "Normal digital multimeter. Working condition. Has test leads.",
      "electronics",
      "good",
      "Building 1, Dhanmondi campus",
      "/images/multimeter.svg"
    ],
    [
      student.insertId,
      "Computer Networks Book",
      "Tanenbaum 6th edition. Some chapters are highlighted. Useful for networking course.",
      "textbooks",
      "fair",
      "Near library",
      "/images/book.svg"
    ],
    [
      staff.insertId,
      "Soldering Iron",
      "Soldering station with stand. Please use in lab only and return with all parts.",
      "tools",
      "good",
      "Hardware Lab",
      "/images/soldering.svg"
    ]
  ];

  for (const item of demoItems) {
    await pool.query(
      `INSERT INTO items
        (owner_id, title, description, category, condition_note, location, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      item
    );
  }
}

module.exports = { initDatabase };
