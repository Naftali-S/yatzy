/**
 * routes/games.js
 * The game API. Every route except `start a game` works on one game,
 * found by its id in the URL. Successful responses send back the game's full state so the browser can redraw the page from it.
 * 
 * POST     /api/games                      start a new game
 * GET      /api/games/:id                  get a game's current state
 * POST     /api/games/:id/roll             roll the dice that aren't kept
 * PUT      /api/games/:id/dice/:index      keep or release one die
 * PUT      /api/games/:id/scores/:category score a box and end the turn
 * DELETE   /api/games/:id                  end the game and remove it
 */

import express from "express";
import { createGame, getGame, deleteGame } from "../game/game_store.js";
import { CATEGORIES } from "../game/yatzy_engine.js";

const router = express.Router();
const MAX_PLAYERS = 4;

// --- Helpers ---

/**
 * Builds the JSON sent back for a game: its id plus its full state.
 * @param {string} id - the game id
 * @param {YatzyGame} game 
 * @returns {object}
 */
function gameResponse(id, game) {
    return { gameId: id, ...game.getState() };
}

/**
 * Sends an error as JSON
 * @param {Response} res 
 * @param {number} status - HTTP status code
 * @param {string} message - shown to the player
 */
function sendError(res, status, message) {
    res.status(status).json({ error: message });
}

/**
 * Middleware: finds the game named in the URL and puts it on req.game.
 * Sends 404 if there's no game with that id
 */
function findGame(req, res, next) {
    const game = getGame(req.params.id);
    if (game === undefined) {
        sendError(res, 404, "Game not found. It may have ended or expired. Start a new game.");
        return;
    }
    req.game = game;
    next();
}

/**
 * Runs a move on the game. If the move breaks a rule, the game throws an error
 * and the player gets 409 Conflict with the reason.
 * Otherwise the new game state is sent back.
 * @param {Request} req 
 * @param {Response} res 
 * @param {function(YatzyGame)} move - the move to make
 */
function playMove(req, res, move) {
    try {
        move(req.game);
    } catch (error) {
        sendError(res, 409, error.message);
        return;
    }
    res.json(gameResponse(req.params.id, req.game));
}

/**
 * Checks a list of player names: 1 to MAX_PLAYERS names, none blank.
 * @param {*} players 
 * @returns {boolean}
 */
function isValidPlayerList(players) {
    if (!Array.isArray(players)) {
        return false;
    }
    if (players.length < 1 || players.length > MAX_PLAYERS) {
        return false;
    }
    return players.every((name) => typeof name === "string" && name.trim() !== "");
}

// --- Routes ---

// POST /api/games body (optional): { "players": ["Naftali", "Sam"] }
router.post("/", (req, res) => {
    let players = ["Player 1"];
    const requested = req.body?.players;

    if (requested !== undefined) {
        if (!isValidPlayerList(requested)) {
            sendError(res, 400, `players must be a list of 1 to ${MAX_PLAYERS} names`);
            return;
        }
        players = requested.map((name) => name.trim());
    }

    const { id, game } = createGame(players);
    res.status(201).json(gameResponse(id, game)); // 201 = Created
});

// GET /api/games/:id
router.get("/:id", findGame, (req, res) => {
    res.json(gameResponse(req.params.id, req.game));
});

// POST /api/games/:id/roll
router.post("/:id/roll", findGame, (req, res) => {
    playMove(req, res, (game) => game.roll());
});

// PUT /api/games/:id/dice/:index   body: { "held": true }
router.put("/:id/dice/:index", findGame, (req, res) => {
    const index = Number(req.params.index);
    const diceCount = req.game.diceValues.length;
    const held = req.body?.held;

    if (!Number.isInteger(index) || index < 0 || index >= diceCount) {
        sendError(res, 400, `Die index must be 0-${diceCount - 1}`);
        return;
    }
    if (typeof held !== "boolean") {
        sendError(res, 400, 'Send { "held": true } or { "held": false }');
        return;
    }
    playMove(req, res, (game) => game.setHold(index, held));
});

// PUT /api/games/:id/scores/:category  e.g. /scores/fullHouse
router.put("/:id/scores/:category", findGame, (req, res) => {
    const category = req.params.category;
    if (!CATEGORIES.includes(category)) {
        sendError(res, 400, `Unknown category '${category}'`);
        return;
    }

    let points;
    try {
        points = req.game.endTurn(category);
    } catch (error) {
        sendError(res, 409, error.message);
        return;
    }

    // say what was just scored, for the "Chance: 22 points" message
    res.json({
        ...gameResponse(req.params.id, req.game),
        scored: { category, points },
    });
});

// DELETE /api/games/:id  ends the game early (if needed), returns the final state, removes it
router.delete("/:id", findGame, (req, res) => {
    if (!req.game.isOver) {
        req.game.endGame();
    }
    const finalState = gameResponse(req.params.id, req.game);
    deleteGame(req.params.id);
    res.json(finalState);
});

export default router;