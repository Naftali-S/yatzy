/**
 * main.js
 * Connects the YatzyGame class to the page. It reads the game state,
 * updates the HTML and handles the player's clicks.
 */

import { YatzyGame } from "./yatzy_game.js";
import { CATEGORIES } from "./yatzy_engine.js";

// --- Page elements ---
const diceButtons = document.querySelectorAll(".die");
const rollButton = document.getElementById("roll-btn");
const endTurnButton = document.getElementById("end-turn-btn");
const messageText = document.getElementById("message");
const roundStatus = document.getElementById("round-status");
const rollsLeftBox = document.getElementById("rolls-left");
const rollMarkers = rollsLeftBox.querySelectorAll(".roll-marker");

// pip positions
const PIP_LAYOUTS = {
  1: ["c"],
  2: ["tr", "bl"],
  3: ["tr", "c", "bl"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "c", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

// --- Game State ---
const game = new YatzyGame();
let selectedCategory = null;

// --- Drawing the page ---

/**
 * Updates everything on the page from the game state.
 * @param {number[]} rolledIndexes - dice that were just rolled
 */
function render(rolledIndexes = []) {
  renderDice(rolledIndexes);
  renderRollsLeft();
  renderControls();
}

/**
 * Draws the five dice: pips, held state and screen reader label.
 * @param {number[]} rolledIndexes - dice that were just rolled
 */
function renderDice(rolledIndexes = []) {
  const values = game.diceValues;
  const held = game.heldDice;

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
    button.disabled = value === null || game.isOver;

    // pressed tells screen readers this is an on/off (kept/not kept) button
    button.setAttribute("aria-pressed", held[i]);

    if (rolledIndexes.includes(i)) {
      button.classList.add("rolling"); // removed again when the animation ends
    }
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
  const rollsLeft = game.rollsLeft;
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
  rollButton.disabled = game.rollsLeft === 0 || game.isOver;
  endTurnButton.disabled = selectedCategory === null || game.isOver;
  roundStatus.textContent = `Round ${game.currentRound} of ${CATEGORIES.length}`;
}

/**
 * Shows a prompt in the message bar.
 * @param {string} text
 */
function showMessage(text) {
  messageText.textContent = text;
}

// --- Event handlers ---

/**
 * Roll Dice: rolls every die that isn't kept.
 */
function handleRoll() {
  // The dice that aren't held are those that get rolled
  const rolledIndexes = [];
  game.heldDice.forEach((isHeld, i) => {
    if (!isHeld) rolledIndexes.push(i);
  });

  try {
    game.roll();
  } catch (error) {
    showMessage(error.message);
    return;
  }

  render(rolledIndexes);
  showMessage(rollMessage());
}

/**
 * The prompt to show after a roll, based on how many rolls are left.
 * @returns {string}
 */
function rollMessage() {
  switch (game.rollsLeft) {
    case 2:
      return "Click any dice you want to keep, then roll again.";
    case 1:
      return "One roll left. Roll again, or choose a box to score.";
    default:
      return "No rolls left. Choose a box on the scorecard, then press End Turn.";
  }
}

/**
 * Clicking a die keeps it (or releases it) fromt he next roll.
 * @param {MouseEvent} event
 */
function handleDieClick(event) {
  const index = Number(event.currentTarget.dataset.index);
  try {
    game.toggleHold(index);
  } catch (error) {
    showMessage(error.message);
    return;
  }
  renderDice();
}

// --- Event listeners ---

rollButton.addEventListener("click", handleRoll);

diceButtons.forEach((button) => {
  button.addEventListener("click", handleDieClick);
  // Remove the tumble class when it finishes, so it can play again next roll
  button.addEventListener("animationend", () => {
    button.classList.remove("rolling");
  });
});

// Draw the starting state
render();
