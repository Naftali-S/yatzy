/**
 * server.js
 * Express server for the Yatzy game (Assignment 2).
 * - Serves the page (HTML, CSS, client JS) from the public folder
 * - Provides the game API under /api/games (see routes/games.js)
 * All dice rolls, rules and scoring happen on the server.
 */

import path from "node:path";
import express from "express";
import gamesRouter from "./routes/games.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Read JSON request bodies into req.body
app.use(express.json());

// Serve index.html, css and js from the public folder
app.use(express.static(path.join(import.meta.dirname, "public")));

// Game API
app.use("/api/games", gamesRouter);

// Any other /api address doesn't exist: answer in JSON, not an HTML page
app.use("/api", (req, res) => {
  res.status(404).json({ error: `No API endpoint for ${req.method} ${req.originalUrl}` });
});

// Error handler (the 4 parameters tell Express this one handles errors).
// Catches badly formed JSON in a request (400) and any unexpected bug (500).
app.use((error, req, res, next) => {
  if (error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Yatzy server running at http://localhost:${PORT}`);
});