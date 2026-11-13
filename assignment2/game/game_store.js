/**
 * game_store.js
 * Keeps every game in progress in server memory, one per game id.
 * Games nobody has used for an hour are removed so memory doesn't keep growing.
 */

import { randomUUID } from "node:crypto";
import { YatzyGame } from "./yatzy_game.js";

const MAX_IDLE_MS = 60 * 60 * 1000; // remove a game after 1 hour without use
const CLEANUP_EVERY_MS = 10 * 60 * 1000; // check for idle games every 10 minutes

// gameID -> { game: YatzyGame, lastUsed: timestamp }
const games = new Map();

/**
 * Creates a new game and stores it.
 * @param {string[]} playerNames - one name per player (default to one player)
 * @returns {{ id: string, game: YatzyGame }} the new game and its id
 */
export function createGame(playerNames) {
    const id = randomUUID();
    const game = new YatzyGame(playerNames);
    games.set(id, { game, lastUsed: Date.now() });
    return { id, game };
}

/**
 * Finds a game by id and marks it as recently used.
 * @param {string} id - the game id
 * @returns {YatzyGame|undefined} the game, or undefined if there isn't one
 */
export function getGame(id) {
    const entry = games.get(id);
    if (entry === undefined) {
        return undefined;
    }
    entry.lastUsed = Date.now();
    return entry.game;
}

/**
 * Removes a game
 * @param {string} id - the game id
 * @returns {boolean} true if a game was removed, false if there wasn't one
 */
export function deleteGame(id) {
    return games.delete(id);
}

function removeIdleGames() {
    const now = Date.now();
    for (const [id, entry] of games) {
        if (now - entry.lastUsed > MAX_IDLE_MS) {
            games.delete(id);
        }
    }
}

// unref() lets the server shutdown normally even though this timer is running
setInterval(removeIdleGames, CLEANUP_EVERY_MS).unref();