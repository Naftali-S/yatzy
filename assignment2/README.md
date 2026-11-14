# Yatzy: Node.js and Express Edition (Assignment 2)

The single-player Yatzy game from Assignment 1, rebuilt so the **server runs the game**. A Node.js and Express server rolls the dice, applies the rules, calculates every score and keeps track of each game. The browser only draws the game and sends the player's moves to the server with the Fetch API.

Game rules, scoring and the visual design are unchanged from Assignment 1. See the [Assignment 1 README](../README.md) for how to play and the scoring rules for each box.

**Author:** Naftali Segal

---

## 1. Setup

### Requirements

- [Node.js](https://nodejs.org/) **20.11 or newer**
- npm (installed with Node.js)

### Install and run

```bash
cd assignment2
npm install        # installs Express (listed in package.json)
npm start          # starts the server
```

Then open **<http://localhost:3000>** in a browser.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the dependencies listed in `package.json` |
| `npm start` | Starts the server |
| `npm run dev` | Starts the server and restarts it automatically whenever a file is saved (for development) |

The server uses port 3000 by default. To use another port, set the `PORT` environment variable.

> The game must be opened through the server (<http://localhost:3000>). Opening `index.html` directly or with Live Server won't work, because the page needs the API.

---

## 2. Project Structure

- `server.js`: Express setup (JSON parsing, static files, API routes, error handling)
- `routes/`
  - `games.js`: the game API (one route per endpoint, input validation, status codes)
- `game/`: game logic, server only (never sent to the browser)
  - `dice.js`: dice values and held state; rolls the dice
  - `yatzy_engine.js`: Yatzy rules, score calculation and the score table
  - `yatzy_game.js`: rounds, turns, rolls left, totals; `getState()` snapshot
  - `game_store.js`: stores every game in progress by id; removes idle games
- `public/`: sent to the browser
  - `index.html`
  - `css/styles.css`
  - `js/api.js`: one fetch function per API endpoint, with error handling
  - `js/main.js`: draws the game from the server's state and handles clicks

Anything in `public/` can be seen by the player. The game logic is kept in `game/`, outside `public/`, so the rules and dice can't be read or changed from the browser.

---

## 3. How It Works

Every move works the same way. For example, when the player presses **Roll Dice**, the page sends `POST /api/games/:id/roll`, the server rolls the dice and sends back the new game state, and the page redraws itself from it.

1. The player clicks something (roll, keep a die, score a box).
2. `main.js` calls a function in `api.js`, which sends the request with `fetch`.
3. The server checks the move against the rules. If it's allowed, it updates the game and sends back the game's **full state** (dice, rolls left, scorecard, score previews, totals, whether the game is over).
4. `main.js` redraws the page from that state.

The browser does no scoring and enforces no rules itself. Even the score previews shown in open boxes are calculated on the server. If someone skips the page and sends requests directly (for example a 4th roll), the server refuses them.

While a request is in progress, the page ignores further clicks, so a double-click can't send the same move twice. The jQuery roll animations  while the server rolls, and the real values appear when both have finished.

---

## 4. Game State Management

- **Every game has its own id.** Games are kept in a `Map` (`game/game_store.js`), keyed by an id from `crypto.randomUUID()`. Several games can run at once (for example in two browser tabs) without affecting each other, and ids can't be guessed.
- **One source of truth.** The `YatzyGame` object on the server holds the real state in private fields. The browser only ever receives a copy made by `getState()`, so nothing the browser does can change the game except through the API.
- **Idle games are removed.** Every 10 minutes, the server removes games that haven't been used for an hour, so memory doesn't keep growing with abandoned games. Games are also removed when the player ends them or starts a new one.
- **Resume after refresh.** The browser saves the game id in `localStorage`. Refreshing the page or reopening the tab continues the same game, as long as the server still has it.
- **Server restarts.** Games are stored in memory, so restarting the server clears them. If the page's game no longer exists, it starts a new game automatically and tells the player.

---

## 5. API Reference

Base URL: `http://localhost:3000/api/games`

All request and response bodies are JSON. Every successful response contains the game's full state (see [Game state object](#game-state-object)).

| Method | Endpoint | Body | Does |
| --- | --- | --- | --- |
| `POST` | `/api/games` | optional: `{ "players": ["Naftali"] }` | Starts a new game (`201 Created`) |
| `GET` | `/api/games/:id` | none | Gets a game's current state |
| `POST` | `/api/games/:id/roll` | none | Rolls every die that isn't kept |
| `PUT` | `/api/games/:id/dice/:index` | `{ "held": true }` | Keeps (`true`) or releases (`false`) die 0-4 |
| `PUT` | `/api/games/:id/scores/:category` | none | Scores the dice in a box and ends the turn |
| `DELETE` | `/api/games/:id` | none | Ends the game, returns the final state and removes it |

**Why these methods:** `GET` only reads. `POST` creates something new each time (a new game, a new roll). `PUT` sets a value, so repeating it gives the same result (keeping a die that's already kept leaves it kept). `DELETE` removes the game.

**Category names** for `/scores/:category`: `ones`, `twos`, `threes`, `fours`, `fives`, `sixes`, `onePair`, `twoPairs`, `threeOfAKind`, `fourOfAKind`, `smallStraight`, `largeStraight`, `fullHouse`, `chance`, `yatzy`.

### Game state object

Example after one roll with the first die kept:

```json
{
  "gameId": "fee81fa8-2e4a-4830-b8cb-49b31553c555",
  "currentPlayer": "Player 1",
  "currentRound": 1,
  "totalRounds": 15,
  "rollsLeft": 2,
  "diceValues": [3, 3, 2, 2, 2],
  "heldDice": [true, false, false, false, false],
  "scoreTable": { "ones": null, "twos": null, "...": null, "yatzy": null },
  "previewScores": { "twos": 6, "threes": 6, "fullHouse": 12, "chance": 12, "...": 0 },
  "upperTotal": 0,
  "bonus": 0,
  "lowerTotal": 0,
  "totalScore": 0,
  "isOver": false,
  "standings": [{ "name": "Player 1", "total": 0 }]
}
```

| Field | Meaning |
| --- | --- |
| `diceValues` | Current dice. `null` before the first roll of a turn |
| `heldDice` | Which dice are kept for the next roll |
| `scoreTable` | Each box's score, or `null` if not used yet |
| `previewScores` | What the current dice would score in each open box (empty before the first roll) |
| `upperTotal`, `bonus`, `lowerTotal`, `totalScore` | Totals; `bonus` is 50 once the upper section reaches 63 |
| `isOver` | `true` after round 15, or when the game is ended early |

`PUT /scores/:category` also returns `"scored": { "category": "chance", "points": 14 }`, so the page can show what was just scored.

### Errors

Errors return a status code and a message that is shown to the player:

```json
{ "error": "No rolls left this turn (maximum 3)" }
```

| Status | When | Example |
| --- | --- | --- |
| `400 Bad Request` | The request itself is invalid | Unknown category, die index 7, `held` not true/false |
| `404 Not Found` | No game with that id (ended, expired or server restarted) | `GET /api/games/not-a-real-id` |
| `409 Conflict` | The request is valid but breaks a game rule | A 4th roll, scoring a box that's already used, scoring before rolling |
| `500 Internal Server Error` | Unexpected server problem | |

---

## 6. Testing

The game was tested by playing it in the browser and by calling the API directly:

- Full 15-round games, including the upper section bonus and the game-over screen
- Kept dice stay the same when rolling; the Roll button disables after 3 rolls
- Ending the game early, then starting a new game
- Refreshing mid-turn restores the same game
- Restarting the server mid-game starts a new game with a message instead of breaking
- Rule-breaking requests sent directly to the API are refused: a 4th roll (409), scoring before rolling (409), scoring a used box (409), an unknown category (400), an unknown game id (404)
- DevTools Network tab confirms every move is a `fetch` request to the API

---

## 7. Changes from Assignment 1

| Assignment 1 (browser only) | Assignment 2 (server) |
| --- | --- |
| Dice rolled in the browser | Dice rolled on the server (`game/dice.js`) |
| Rules and scoring ran in the browser | Rules and scoring run on the server; the browser receives the results |
| Game state kept in a browser variable | Each game stored on the server by id, with idle cleanup |
| Opened with Live Server | Served by Express at <http://localhost:3000> |
| Holding a die toggled it | `PUT` sets it to kept or released, so repeating a request is safe |
| Lost on refresh | Refresh continues the same game |
