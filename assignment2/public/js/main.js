/**
 * main.js
 * Draws the game and handles the player's clicks. Assignment 2: every move
 * is sent to the server with fetch (see api.js), and the page is redrawn from
 * the game state the server sends back. No rules or scoring run in the browser.
 * The roll animation is done with jQuery (from Lab 8).
 */

import * as api from "./api.js";

// --- Page elements ---
const diceButtons = document.querySelectorAll(".die");
const rollButton = document.getElementById("roll-btn");
const endTurnButton = document.getElementById("end-turn-btn");
const messageText = document.getElementById("message");
const roundStatus = document.getElementById("round-status");
const rollsLeftBox = document.getElementById("rolls-left");
const rollMarkers = rollsLeftBox.querySelectorAll(".roll-marker");
const scoreRows = document.querySelectorAll("tr[data-category]");
const upperTotalCell = document.getElementById("upper-total");
const bonusCell = document.getElementById("bonus");
const lowerTotalCell = document.getElementById("lower-total");
const grandTotalCell = document.getElementById("grand-total");
const endGameButton = document.getElementById("end-game-btn");
const gameOverDialog = document.getElementById("game-over");
const finalScoreText = document.getElementById("final-score");
const finalMessageText = document.getElementById("final-message");
const newGameButton = document.getElementById("new-game-btn");

// pip positions
const PIP_LAYOUTS = {
  1: ["c"],
  2: ["tr", "bl"],
  3: ["tr", "c", "bl"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "c", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

// --- Roll animation settings ---
const ROLL_DURATION_MS = 700; // how long the roll lasts
const FACE_CHANGE_MS = 140; // how often the faces flash while rolling
const WOBBLE_DEGREES = 15; // how far the dice rock side to side at the start
const HOP_PX = 10; // how high the dice hop

// --- Game State ---
const SAVED_GAME_KEY = "yatzyGameId"; // localStorage key, so a refresh keeps the game
let gameId = null; // id of this game on the server
let state = null; // the latest game state sent by the server
let selectedCategory = null;
let isWaiting = true; // true while waiting for the server (starts true until the game loads)

// --- Drawing the page ---

/**
 * Updates everything on the page from the game state.
 */
function render() {
  renderDice();
  renderRollsLeft();
  renderControls();
  renderScorecard();
}

/**
 * Draws the five dice: pips, held state and screen reader label.
 */
function renderDice() {
  const values = state.diceValues;
  const held = state.heldDice;

  diceButtons.forEach((button, i) => {
    const value = values[i];
    const dieNumber = i + 1;

    if (value === null) {
      // Not rolled yet
      button.replaceChildren();
      button.setAttribute("aria-label", `Die ${dieNumber}, not rolled`);
    } else {
      // Swap the old pips for the pips of the new value
      const pips = PIP_LAYOUTS[value].map(createPip);
      button.replaceChildren(...pips);

      let label = `Die ${dieNumber} showing ${value}`;
      if (held[i]) {
        label += ", kept";
      }
      button.setAttribute("aria-label", label);
    }

    button.classList.toggle("held", held[i]);
    button.disabled = value === null || state.isOver;

    // pressed tells screen readers this is an on/off (kept/not kept) button
    button.setAttribute("aria-pressed", held[i]);
  });
}

/**
 * Creates one pip for a die.
 * @param {string} position - pip position class from styles.css
 * @returns {HTMLSpanElement}
 */
function createPip(position) {
  const pip = document.createElement("span");
  pip.className = `pip ${position}`;
  return pip;
}

/**
 * Fills one gold marker per roll still available
 */
function renderRollsLeft() {
  const rollsLeft = state.rollsLeft;
  rollMarkers.forEach((marker, i) => {
    marker.classList.toggle("available", i < rollsLeft);
  });

  let label = `${rollsLeft} rolls left`;
  if (rollsLeft === 1) {
    label = "1 roll left";
  }
  rollsLeftBox.setAttribute("aria-label", label);
}

/**
 * Turns the buttons on or off and updates the round number.
 */
function renderControls() {
  rollButton.disabled = isWaiting || state.rollsLeft === 0 || state.isOver;
  endTurnButton.disabled =
    isWaiting || selectedCategory === null || state.isOver;
  roundStatus.textContent = `Round ${state.currentRound} of ${state.totalRounds}`;

  // Once the game is over, the End Game link starts a new game instead
  if (state.isOver) {
    endGameButton.textContent = "New game";
  } else {
    endGameButton.textContent = "End game";
  }
}

/**
 * Draws the scorecard: scored boxes, previews for open boxes,
 * the selected box and the totals
 */
function renderScorecard() {
  const scores = state.scoreTable;
  const previews = state.previewScores; // empty before the first roll

  scoreRows.forEach((row) => {
    const category = row.dataset.category;
    const cell = row.querySelector(".score");

    // Start from a clean row, then add back the classes that apply
    row.classList.remove("open", "filled", "selected");
    cell.classList.remove("preview");

    if (scores[category] !== null) {
      // Already scored: show the locked-in score
      row.classList.add("filled");
      row.removeAttribute("tabindex"); // can't be chosen again
      cell.textContent = scores[category];
    } else if (category in previews && !state.isOver) {
      // Open this turn: show what the dice would score
      row.classList.add("open");
      row.tabIndex = 0; // reachable with Tab
      cell.classList.add("preview");
      cell.textContent = previews[category];

      if (category === selectedCategory) {
        row.classList.add("selected");
      }
    } else {
      // Not scored, and no roll yet this turn
      row.removeAttribute("tabindex");
      cell.textContent = "";
    }
  });

  upperTotalCell.textContent = state.upperTotal;
  bonusCell.textContent = state.bonus;
  lowerTotalCell.textContent = state.lowerTotal;
  grandTotalCell.textContent = state.totalScore;
}

/**
 * Gets a box's name from its scorecard row.
 * @param {HTMLTableRowElement} row
 * @returns {string}
 */
function categoryName(row) {
  return row.cells[0].firstChild.textContent.trim();
}

/**
 * Writes a score as "1 point" or "12 points".
 * @param {number} points
 * @returns {string}
 */
function pointsText(points) {
  if (points === 1) {
    return "1 point";
  }
  return `${points} points`;
}

/**
 * Shows a prompt in the message bar.
 * @param {string} text
 */
function showMessage(text) {
  messageText.textContent = text;
}

/**
 * Opens the game over pop-up with the final score and a message.
 */
function showGameOver() {
  const total = state.totalScore;
  finalScoreText.textContent = total;
  finalMessageText.textContent = finalMessage(total);
  showMessage(`Game over. Your final score is ${pointsText(total)}.`);
  gameOverDialog.showModal();
}

/**
 * Congratulates or consoles the player based on their final score.
 * @param {number} total - the final score
 * @returns {string}
 */
function finalMessage(total) {
  const roundsPlayed = state.totalRounds - countOpenBoxes();

  let message;
  if (total >= 250) {
    message = "Outstanding! That's a high-roller's score.";
  } else if (total >= 200) {
    message = "Great game! The dice were on your side.";
  } else if (total >= 150) {
    message = "Nicely played. A solid score.";
  } else {
    message = "Tough luck with the dice this time. Try again?";
  }

  if (roundsPlayed < state.totalRounds) {
    message = `You ended the game after ${roundsPlayed} of ${state.totalRounds} rounds. ${message}`;
  }
  return message;
}

/**
 * Counts the scorecard boxes that haven't been scored yet.
 * @returns {number}
 */
function countOpenBoxes() {
  return Object.values(state.scoreTable).filter((score) => score === null)
    .length;
}

/**
 * Random face for the spin animation only.
 * The real roll is still done by the server.
 * @returns {number} 1 to 6
 */
function randomFace() {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Rolls the given dice with jQuery: a small hop plus a side-to-side
 * wobble that settles down, while flashing random faces on them.
 * @param {jQuery} $dice - the dice to roll (the ones not kept)
 * @returns {Promise} resolves when the roll animation has finished
 */
function spinDice($dice) {
  // Flash a random face on every rolling die
  const shuffleTimer = setInterval(function () {
    $dice.each(function () {
      const pips = PIP_LAYOUTS[randomFace()].map(createPip);
      $(this).empty().append(pips);
    });
  }, FACE_CHANGE_MS);

  // jQuery animates progress from 0 to 1, and step() turns it into
  // a small hop plus a side-to-side wobble that settles down
  return $({ progress: 0 })
    .animate(
      { progress: 1 },
      {
        duration: ROLL_DURATION_MS,
        easing: "linear", // the settling is done by the math below
        step: function (now) {
          // Rocks back and forth, getting smaller as now goes from 0 to 1
          const angle =
            Math.sin(now * Math.PI * 4) * WOBBLE_DEGREES * (1 - now);
          // One arc up and back down (negative = up on screen)
          const lift = Math.sin(now * Math.PI) * -HOP_PX;

          $dice.css("rotate", angle + "deg");
          $dice.css("translate", "0 " + lift + "px");
        },
        complete: function () {
          clearInterval(shuffleTimer);
          $dice.css("rotate", ""); // back to straight
          $dice.css("translate", ""); // back down
        },
      },
    )
    .promise();
}

// --- Talking to the server ---

/**
 * Remembers the game id (in memory and in localStorage) so a page refresh
 * continues the same game. Pass null to forget it.
 * @param {string|null} id
 */
function rememberGame(id) {
  gameId = id;
  try {
    if (id === null) {
      localStorage.removeItem(SAVED_GAME_KEY);
    } else {
      localStorage.setItem(SAVED_GAME_KEY, id);
    }
  } catch {
    // Storage is blocked (e.g. private mode): the game still works, it just won't resume
  }
}

/**
 * @returns {string|null} the id saved by rememberGame, or null
 */
function savedGameId() {
  try {
    return localStorage.getItem(SAVED_GAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Asks the server for a new game and makes it the current one.
 * Doesn't redraw the page (the caller does that).
 */
async function startNewGame() {
  state = await api.startGame();
  rememberGame(state.gameId);
  selectedCategory = null;
}

/**
 * Shows a failed request to the player. If the server no longer has this
 * game (it restarted, or the game expired), a new game is started instead.
 * @param {Error} error - from api.js; error.status is the HTTP status
 */
async function handleRequestError(error) {
  console.error(error);
  if (error.status === 404) {
    try {
      await startNewGame();
    } catch (startError) {
      showMessage(startError.message);
      return;
    }
    render();
    showMessage(
      "That game is no longer on the server, so a new game has started.",
    );
    return;
  }
  render(); // puts the page back the way it was
  showMessage(error.message);
}

/**
 * Runs when the page loads: continues the saved game if the server still
 * has it, otherwise starts a new one.
 */
async function init() {
  const savedId = savedGameId();
  if (savedId !== null) {
    try {
      state = await api.getGame(savedId);
      gameId = savedId;
      isWaiting = false;
      render();
      showMessage("Welcome back. Your game has been restored.");
      if (state.isOver) {
        showGameOver();
      }
      return;
    } catch {
      // The saved game is gone: fall through and start a new one
    }
  }

  try {
    await startNewGame();
  } catch (error) {
    showMessage(error.message);
    return; // buttons stay disabled until the server is running and the page is reloaded
  }
  isWaiting = false;
  render();
  showMessage("Roll the dice to start your turn.");
}

// --- Event handlers ---

/**
 * Roll Dice: asks the server to roll every die that isn't kept while
 * jQuery spins those dice. The new values are only shown once the spin
 * has finished. If the request fails, the dice go back to what they were
 * and the error is shown.
 */
async function handleRoll() {
  if (isWaiting) {
    return; // already waiting on the server
  }

  // The dice that aren't held are the ones that get rolled
  const rolledIndexes = [];
  state.heldDice.forEach((isHeld, i) => {
    if (!isHeld) rolledIndexes.push(i);
  });

  isWaiting = true;
  renderControls();
  showMessage("Rolling...");

  // Wrap the dice in jQuery and keep only the ones being rolled
  const $rollingDice = $(diceButtons).filter(function (i) {
    return rolledIndexes.includes(i);
  });

  // Start the server request and the spin at the same time
  const serverRoll = api.rollDice(gameId);
  const spin = spinDice($rollingDice);

  // Wait for both. allSettled waits even if the request fails
  const [rollResult] = await Promise.allSettled([serverRoll, spin]);

  isWaiting = false;

  if (rollResult.status === "rejected") {
    await handleRequestError(rollResult.reason);
    return;
  }

  state = rollResult.value; // the new dice, rolls left and score previews
  selectedCategory = null; // dice changed, so the player chooses again
  render();
  showMessage(rollMessage());
}

/**
 * The prompt to show after a roll, based on how many rolls are left.
 * @returns {string}
 */
function rollMessage() {
  switch (state.rollsLeft) {
    case 2:
      return "Click any dice you want to keep, then roll again.";
    case 1:
      return "One roll left. Roll again, or choose a box to score.";
    default:
      return "No rolls left. Choose a box on the scorecard, then press End Turn.";
  }
}

/**
 * Clicking a die asks the server to keep it (or release it) for the next roll.
 * @param {MouseEvent} event
 */
async function handleDieClick(event) {
  if (isWaiting) {
    return; // don't change which dice are kept while waiting on the server
  }
  const index = Number(event.currentTarget.dataset.index);
  const keep = !state.heldDice[index];

  isWaiting = true;
  let newState;
  try {
    newState = await api.setHold(gameId, index, keep);
  } catch (error) {
    isWaiting = false;
    await handleRequestError(error);
    return;
  }
  isWaiting = false;

  state = newState;
  renderDice();
}

/**
 * Clicking an open scorecard box selects it (clicking it again unselects it).
 * The score isn't recorded until the player presses End Turn.
 * @param {Event} event
 */
function handleScoreClick(event) {
  const row = event.currentTarget;
  if (isWaiting || !row.classList.contains("open")) {
    return; // already scored, or no roll yet
  }

  const category = row.dataset.category;
  if (selectedCategory === category) {
    selectedCategory = null;
    showMessage("Choose a box to score, then press End Turn.");
  } else {
    selectedCategory = category;
    const points = state.previewScores[category];
    showMessage(
      `${categoryName(row)} for ${pointsText(points)}. Press End Turn to score it.`,
    );
  }

  renderScorecard();
  renderControls();
}

/**
 * Lets keyboard players select a box with Enter or Space.
 * @param {KeyboardEvent} event
 */
function handleScoreKey(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault(); // Stop Space from scrolling the page
    handleScoreClick(event);
  }
}

/**
 * End Turn: sends the selected box to the server, which scores it and
 * moves on to the next round.
 */
async function handleEndTurn() {
  if (isWaiting || selectedCategory === null) {
    return;
  }
  const row = document.querySelector(`tr[data-category="${selectedCategory}"]`);

  isWaiting = true;
  renderControls();
  let result;
  try {
    result = await api.scoreCategory(gameId, selectedCategory);
  } catch (error) {
    isWaiting = false;
    await handleRequestError(error);
    return;
  }
  isWaiting = false;

  state = result;
  selectedCategory = null;
  render();

  // After the last round, the server ends the game by itself
  if (state.isOver) {
    showGameOver();
    return;
  }
  showMessage(
    `${categoryName(row)}: ${pointsText(result.scored.points)}. Roll the dice to start round ${state.currentRound}.`,
  );
}

/**
 * End Game: lets the player stop early after confirming. The server ends
 * the game, sends back the final scores and removes it.
 * Once the game is over the same link starts a new game.
 */
async function handleEndGame() {
  if (isWaiting) {
    return;
  }
  if (state.isOver) {
    handleNewGame();
    return;
  }

  const confirmed = confirm(
    "End the game now? Your current score will be your final score.",
  );
  if (!confirmed) {
    return;
  }

  isWaiting = true;
  let finalState;
  try {
    finalState = await api.endGame(gameId);
  } catch (error) {
    isWaiting = false;
    await handleRequestError(error);
    return;
  }
  isWaiting = false;

  state = finalState;
  rememberGame(null); // the server has removed this game
  selectedCategory = null;
  render();
  showGameOver();
}

/**
 * Play Again / New Game: removes the finished game from the server
 * and starts a new one.
 */
async function handleNewGame() {
  if (isWaiting) {
    return;
  }
  isWaiting = true;
  gameOverDialog.close();

  // A game that ended after round 15 is still on the server, so remove it.
  // (If End Game was used, it's already gone and gameId is null.)
  if (gameId !== null) {
    try {
      await api.endGame(gameId);
    } catch {
      // Already gone (e.g. the server restarted): nothing to clean up
    }
  }

  try {
    await startNewGame();
  } catch (error) {
    isWaiting = false;
    showMessage(error.message);
    return;
  }
  isWaiting = false;
  render();
  showMessage("New game. Roll the dice to start your turn.");
}

// --- Event listeners ---

// Lab 8: jQuery attaches the Roll button's click listener
$("#roll-btn").on("click", handleRoll);

endTurnButton.addEventListener("click", handleEndTurn);
endGameButton.addEventListener("click", handleEndGame);
newGameButton.addEventListener("click", handleNewGame);

scoreRows.forEach((row) => {
  row.addEventListener("click", handleScoreClick);
  row.addEventListener("keydown", handleScoreKey);
});

diceButtons.forEach((button) => {
  button.addEventListener("click", handleDieClick);
});

// Load the game from the server, then draw it
init();
