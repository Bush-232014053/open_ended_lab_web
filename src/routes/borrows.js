const express = require("express");
const { requireAuth } = require("../middleware/auth");

function borrowsRouter(pool) {
  const router = express.Router();

  router.post("/:itemId", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { message, start_date, due_date } = req.body;
      if (!start_date || !due_date) {
        return res.status(400).json({ error: "Start and return dates are required." });
      }
      if (new Date(due_date) < new Date(start_date)) {
        return res.status(400).json({ error: "Return date must be after the start date." });
      }

      await conn.beginTransaction();
      const [items] = await conn.query("SELECT * FROM items WHERE id = ? FOR UPDATE", [
        req.params.itemId
      ]);
      if (!items.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Item not found." });
      }

      const item = items[0];
      if (item.owner_id === req.session.user.id) {
        await conn.rollback();
        return res.status(400).json({ error: "You cannot borrow your own item." });
      }
      if (item.status !== "available") {
        await conn.rollback();
        return res.status(409).json({ error: "This item is not available right now." });
      }

      const [existing] = await conn.query(
        `SELECT id FROM borrow_requests
         WHERE item_id = ? AND borrower_id = ? AND status = 'pending'`,
        [item.id, req.session.user.id]
      );
      if (existing.length) {
        await conn.rollback();
        return res.status(409).json({ error: "You already have a pending request for this item." });
      }

      const [result] = await conn.query(
        `INSERT INTO borrow_requests (item_id, borrower_id, message, start_date, due_date)
         VALUES (?, ?, ?, ?, ?)`,
        [item.id, req.session.user.id, message || null, start_date, due_date]
      );
      await conn.query("UPDATE items SET status = 'pending' WHERE id = ?", [item.id]);
      await conn.commit();

      const [rows] = await pool.query("SELECT * FROM borrow_requests WHERE id = ?", [
        result.insertId
      ]);
      res.status(201).json({ request: rows[0] });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: "Could not send borrow request." });
    } finally {
      conn.release();
    }
  });

  router.get("/incoming", requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT br.*, items.title, items.image_url, items.status AS item_status,
                borrower.full_name AS borrower_name, borrower.email AS borrower_email,
                borrower.campus_id AS borrower_campus_id
         FROM borrow_requests br
         JOIN items ON items.id = br.item_id
         JOIN users borrower ON borrower.id = br.borrower_id
         WHERE items.owner_id = ?
         ORDER BY br.created_at DESC`,
        [req.session.user.id]
      );
      res.json({ requests: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load incoming requests." });
    }
  });

  router.get("/outgoing", requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT br.*, items.title, items.image_url, items.location,
                owner.full_name AS owner_name, owner.email AS owner_email
         FROM borrow_requests br
         JOIN items ON items.id = br.item_id
         JOIN users owner ON owner.id = items.owner_id
         WHERE br.borrower_id = ?
         ORDER BY br.created_at DESC`,
        [req.session.user.id]
      );
      res.json({ requests: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your requests." });
    }
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const action = req.body.action;
      const allowed = ["approve", "reject", "return", "cancel"];
      if (!allowed.includes(action)) {
        return res.status(400).json({ error: "Unknown action." });
      }

      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT br.*, items.owner_id, items.id AS item_pk
         FROM borrow_requests br
         JOIN items ON items.id = br.item_id
         WHERE br.id = ? FOR UPDATE`,
        [req.params.id]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Request not found." });
      }

      const request = rows[0];
      const isOwner = request.owner_id === req.session.user.id;
      const isBorrower = request.borrower_id === req.session.user.id;

      if (action === "cancel") {
        if (!isBorrower || request.status !== "pending") {
          await conn.rollback();
          return res.status(403).json({ error: "Only the borrower can cancel a pending request." });
        }
        await conn.query("UPDATE borrow_requests SET status = 'cancelled' WHERE id = ?", [
          request.id
        ]);
        await conn.query("UPDATE items SET status = 'available' WHERE id = ?", [request.item_pk]);
      }

      if (action === "approve") {
        if (!isOwner || request.status !== "pending") {
          await conn.rollback();
          return res.status(403).json({ error: "Only the owner can approve a pending request." });
        }
        await conn.query("UPDATE borrow_requests SET status = 'approved' WHERE id = ?", [
          request.id
        ]);
        await conn.query("UPDATE items SET status = 'borrowed' WHERE id = ?", [request.item_pk]);
        await conn.query(
          `UPDATE borrow_requests SET status = 'rejected'
           WHERE item_id = ? AND id <> ? AND status = 'pending'`,
          [request.item_pk, request.id]
        );
      }

      if (action === "reject") {
        if (!isOwner || request.status !== "pending") {
          await conn.rollback();
          return res.status(403).json({ error: "Only the owner can reject a pending request." });
        }
        await conn.query("UPDATE borrow_requests SET status = 'rejected' WHERE id = ?", [
          request.id
        ]);
        await conn.query("UPDATE items SET status = 'available' WHERE id = ?", [request.item_pk]);
      }

      if (action === "return") {
        if (!isOwner || request.status !== "approved") {
          await conn.rollback();
          return res.status(403).json({ error: "Only the owner can mark an approved loan as returned." });
        }
        await conn.query("UPDATE borrow_requests SET status = 'returned' WHERE id = ?", [
          request.id
        ]);
        await conn.query("UPDATE items SET status = 'available' WHERE id = ?", [request.item_pk]);
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: "Could not update request." });
    } finally {
      conn.release();
    }
  });

  return router;
}

module.exports = borrowsRouter;
