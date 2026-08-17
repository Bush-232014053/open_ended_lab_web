const express = require("express");
const bcrypt = require("bcryptjs");
const { publicUser } = require("../middleware/auth");

function authRouter(pool) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    try {
      const {
        full_name,
        email,
        password,
        role,
        campus_id,
        department,
        phone
      } = req.body;

      if (!full_name || !email || !password || !campus_id || !department) {
        return res.status(400).json({ error: "Please fill in all required fields." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }

      const userRole = role === "staff" ? "staff" : "student";
      const hash = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, campus_id, department, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [full_name, email.toLowerCase().trim(), hash, userRole, campus_id, department, phone || null]
      );

      const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
      req.session.user = publicUser(rows[0]);
      res.status(201).json({ user: req.session.user });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "An account with this email already exists." });
      }
      console.error(err);
      res.status(500).json({ error: "Could not create account." });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
        (email || "").toLowerCase().trim()
      ]);

      if (!rows.length) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const match = await bcrypt.compare(password || "", rows[0].password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      req.session.user = publicUser(rows[0]);
      res.json({ user: req.session.user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed." });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  router.get("/me", (req, res) => {
    res.json({ user: req.session.user || null });
  });

  return router;
}

module.exports = authRouter;
