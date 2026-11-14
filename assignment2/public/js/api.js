/**
 * api.js
 * Talks to the Yatzy server. Each function sends one request and returns
 * the game state the server sends back. The browser only shows what the
 * server says.
 */

const BASE_URL = "/api/games";
const REQUEST_TIMEOUT_MS = 5000; // give up if the server takes longer than 5 seconds

/**
 *
 * @param {string} method - "GET", "POST", "PUT" or "DELETE"
 * @param {string} path - added to BASE_URL
 * @param {object} [body] - sent as JSON when given
 * @returns {Promise<object>} the parsed response
 * @throws {Error} with a message that can be shown to the player.
 *   error.status is the HTTP code.
 */
async function request(method, path, body) {
  const options = {
    method,
    headers: {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE_URL + path, options);
  } catch (error) {
    throw requestError(
      "Couldn't reach the game server. Check that it's running, then try again.",
      0,
      error,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw requestError(
      `The game server sent back something unexpected (error ${response.status}).`,
      response.status,
      error,
    );
  }

  if (!response.ok) {
    // The server explains what went wrong
    throw requestError(data.error, response.status);
  }
  return data;
}

function requestError(message, status, cause) {
  const error = new Error(message, { cause });
  error.status = status;
  return error;
}

// --- One function per API endpoint ---

/**
 * POST /api/games: starts a new game.
 * @param {string[]} [players] - player names (defaults to one player)
 * @returns {Promise<object>} the new game's state, including gameId
 */
export function startGame(players) {
  let body;
  if (players !== undefined) {
    body = { players };
  }
  return request("POST", "", body);
}

/**
 * GET /api/games/:id: gets a game's current state.
 * @param {string} gameId
 * @returns {Promise<object>}
 */
export function getGame(gameId) {
  return request("GET", `/${gameId}`);
}

/**
 * POST /api/games/:id/roll: rolls every die that isn't kept.
 * @param {string} gameId
 * @returns {Promise<object>}
 */
export function rollDice(gameId) {
  return request("POST", `/${gameId}/roll`);
}

/**
 * PUT /api/games/:id/dice/:index: keeps or releases one die.
 * @param {string} gameId
 * @param {number} index - position of the die (0-4)
 * @param {boolean} held - true to keep it, false to release it
 * @returns {Promise<object>}
 */
export function setHold(gameId, index, held) {
  return request("PUT", `/${gameId}/dice/${index}`, { held });
}

/**
 * PUT /api/games/:id/scores/:category: scores a box and ends the turn.
 * @param {string} gameId
 * @param {string} category - e.g. "fullHouse"
 * @returns {Promise<object>} the new state, plus scored: { category, points }
 */
export function scoreCategory(gameId, category) {
  return request("PUT", `/${gameId}/scores/${category}`);
}

/**
 * DELETE /api/games/:id: ends the game and removes it from the server.
 * @param {string} gameId
 * @returns {Promise<object>} the final state of the game
 */
export function endGame(gameId) {
  return request("DELETE", `/${gameId}`);
}
