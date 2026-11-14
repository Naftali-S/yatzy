/**
 * dice.js
 * Dice module (server side): dice values and held state.
 * Assignment 2: the dice are rolled here on the server, so the browser
 * can't choose or change the values.
 */

const SIDES = 6;
const DEFAULT_COUNT = 5;

export class Dice {
  // Private fields
  #values; // current face of each die; null = not rolled
  #held; // Boolean for each die
  #count; // number of dice

  /**
   * Creates the dice
   * @param {number} count - number of dice
   */
  constructor(count = DEFAULT_COUNT) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(
        `Number of dice must be a whole number of 1 or more, got ${count}`,
      );
    }
    this.#count = count;
    this.reset();
  }

  /**
   * Rolls every die that is not held.
   * @returns {number[]} a copy of the dice values after the roll
   */
  rollAll() {
    for (let i = 0; i < this.#count; i++) {
      if (!this.#held[i]) {
        this.#values[i] = Dice.#rollOne();
      }
    }
    return this.values;
  }

  /**
   * Holds or releases one die.
   * Sets the state rather than toggling it, so sending the same request
   * twice gives the same result (what a PUT request should do).
   * @param {number} index - position of the die (0-4)
   * @param {boolean} held - true to keep the die, false to release it
   * @returns {boolean} the die's new held state
   */
  setHold(index, held) {
    this.#checkIndex(index);
    if (typeof held !== "boolean") {
      throw new TypeError("held must be true or false");
    }
    if (this.#values[index] === null) {
      throw new Error("Cannot hold a die before it has been rolled");
    }
    this.#held[index] = held;
    return held;
  }

  /**
   * Clears all values and releases all holds (start of a new turn)
   */
  reset() {
    this.#values = Array(this.#count).fill(null);
    this.#held = Array(this.#count).fill(false);
  }

  /**
   * Current dice values. Returns a copy, so code outside this class
   * can read the values but can't change them.
   * @returns {(number|null)[]}
   */
  get values() {
    return [...this.#values];
  }

  /**
   * @returns {boolean[]} a copy of the held state for each die
   */
  get held() {
    return [...this.#held];
  }

  get count() {
    return this.#count;
  }

  /**
   * Private helper: stops invalid indexes like -1 or 7
   * @param {number} index - position to check
   */
  #checkIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.#count) {
      throw new RangeError(
        `Die index must be 0-${this.#count - 1}, got ${index}`,
      );
    }
  }

  /**
   * Private helper: rolls a single die.
   * @returns {number} a random whole number from 1 to 6
   */
  static #rollOne() {
    return Math.floor(Math.random() * SIDES) + 1;
  }
}