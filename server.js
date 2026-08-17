require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const { initDatabase } = require("./src/db");
const authRouter = require("./src/routes/auth");
const itemsRouter = require("./src/routes/items");
const borrowsRouter = require("./src/routes/borrows");

const app = express();
const PORT = process.env.PORT || 3000;

// parse form/json data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "campus-library-lab",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
  })
);
app.use(express.static(path.join(__dirname, "public")));

async function start() {
  const pool = await initDatabase();

  app.use("/api/auth", authRouter(pool));
  app.use("/api/items", itemsRouter(pool));
  app.use("/api/borrows", borrowsRouter(pool));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log("Campus Library running at http://localhost:" + PORT);
  });
}

start().catch((err) => {
  console.error("Server failed to start.");
  console.error(err.message);
  console.error("Open XAMPP, start MySQL, then run npm start");
  process.exit(1);
});
