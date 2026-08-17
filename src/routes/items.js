const express = require("express");
const path = require("path");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../public/uploads"),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  }
});

function itemsRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const { q, category, status } = req.query;
      let sql = `
        SELECT items.*, users.full_name AS owner_name, users.department AS owner_department
        FROM items
        JOIN users ON users.id = items.owner_id
        WHERE 1 = 1
      `;
      const params = [];

      if (q) {
        sql += " AND (items.title LIKE ? OR items.description LIKE ? OR items.location LIKE ?)";
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (category && category !== "all") {
        sql += " AND items.category = ?";
        params.push(category);
      }
      if (status && status !== "all") {
        sql += " AND items.status = ?";
        params.push(status);
      }

      sql += " ORDER BY items.created_at DESC";
      const [rows] = await pool.query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load items." });
    }
  });

  router.get("/mine", requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC",
        [req.session.user.id]
      );
      res.json({ items: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your items." });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT items.*, users.full_name AS owner_name, users.email AS owner_email,
                users.department AS owner_department, users.role AS owner_role
         FROM items
         JOIN users ON users.id = items.owner_id
         WHERE items.id = ?`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: "Item not found." });
      res.json({ item: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load item." });
    }
  });

  router.post("/", requireAuth, upload.single("image"), async (req, res) => {
    try {
      const { title, description, category, condition_note, location } = req.body;
      if (!title || !description || !category || !location) {
        return res.status(400).json({ error: "Please complete the item details." });
      }

      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const [result] = await pool.query(
        `INSERT INTO items
          (owner_id, title, description, category, condition_note, location, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.session.user.id,
          title,
          description,
          category,
          condition_note || "good",
          location,
          imageUrl
        ]
      );

      const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [result.insertId]);
      res.status(201).json({ item: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Could not list item." });
    }
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: "Item not found." });
      if (rows[0].owner_id !== req.session.user.id) {
        return res.status(403).json({ error: "You can only remove your own listings." });
      }
      await pool.query("DELETE FROM items WHERE id = ?", [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not delete item." });
    }
  });

  return router;
}

module.exports = itemsRouter;
