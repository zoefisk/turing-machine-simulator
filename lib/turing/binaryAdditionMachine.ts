
// States needed to implement single-tape addition:
export type BinaryAdditionState =
  | "SEEK_LEFT"                 // The head looks for the next left-side bit to add, marking it if found
  | "SEEK_RIGHT"                // The head looks for the next right-side bit to add, marking it if found
  | "SEEK_RESULT"               // The head moves to the current result cell and writes the next result bit
  | "SEEK_RIGHT_MARK"           // The head moves back to the marked right-side bit to restore it
  | "SEEK_LEFT_MARK"            // The head moves back to the marked left-side bit to restore it and shift the machine's attention leftward
  | "SEEK_FINAL_RESULT"         // The head moves to the final result cell to write a last carry if needed
  | "HALT";                     // The machine halts

/**
 * BinaryAdditionSnapshot:
 * Includes all of the live information about the machine's configuration at a given moment. This is used for
 * rendering the tape and head position on the frontend, as well as for generating the explanations that accompany
 * each transition for learning.
 */
export type BinaryAdditionSnapshot = {
  state: BinaryAdditionState;       // The current control state of the machine, which determines its behavior on the next step
  tape: string[];                   // The current contents of the tape, represented as an array of single-character strings for easy rendering
  head: number;                     // The current index of the tape head, which points to the cell that will be read or written on the next step
  carry: 0 | 1;                     // The current carry value stored in the control, which is either 0 or 1 for binary addition
  columnRule?: {
    carryIn: 0 | 1;                 // The carry value that was present before this column was computed
    carryOut: 0 | 1;                // The carry value that results after adding this column
    leftBit: 0 | 1;                 // The bit taken from the left operand for this column
    resultBit: 0 | 1;               // The bit that should be written into the result area for this column
    rightBit: 0 | 1;                // The bit taken from the right operand for this column
  };
  message: string;                  // A human-readable explanation of what happened during this step
  transitionKind: "compute"         // A small category used by the UI to explain the type of action
                | "halt"
                | "mark"
                | "move"
                | "restore"
                | "write";
  highlightedIndex?: number;        // The tape cell that the frontend should emphasize for this snapshot
  lastTransition?: string;          // The state-diagram edge id that should be highlighted for this step
  resultStart: number;              // The index where the result zone begins on the tape
};

/**
 * createBinaryAdditionMachine:
 * Builds the entire single-tape machine for an input of the form "leftcright". The tape is laid out as:
 * [left bits][c][right bits][|][blank result cells]
 *
 * The machine works from right to left across the two inputs, temporarily marking the active bits,
 * computing the next result bit and carry, writing the result bit into the result zone, and then
 * restoring the input symbols before moving to the next more-significant column.
 *
 * input: The full input string, where the left binary number appears before c and the right binary number appears after c.
 */
export function createBinaryAdditionMachine(input: string) {
  const [leftOperand = "", rightOperand = ""] = input.split("c");
  const resultWidth = Math.max(leftOperand.length, rightOperand.length) + 1;
  const tape = [
    ...leftOperand.split(""),
    "c",
    ...rightOperand.split(""),
    "|",
    ...Array.from({ length: resultWidth }, () => "_"),
  ];

  // These indices describe the main regions of the single tape.
  const leftStart = 0;
  const leftEnd = leftOperand.length - 1;
  const inputSeparatorIndex = leftOperand.length;
  const rightStart = inputSeparatorIndex + 1;
  const rightEnd = rightStart + rightOperand.length - 1;
  const resultSeparatorIndex = rightEnd + 1;
  const resultStart = resultSeparatorIndex + 1;

  // These cursors track which column of each region the machine is currently working on.
  let leftCursor = leftEnd;
  let rightCursor = rightEnd;
  let resultCursor = resultStart + resultWidth - 1;

  // This is the live control-state information of the machine.
  let head = leftEnd >= leftStart ? leftEnd : inputSeparatorIndex;
  let state: BinaryAdditionState = "SEEK_LEFT";
  let carry: 0 | 1 = 0;
  let lastTransition: string | undefined = "start-q0";

  // These staged values let the machine remember a single column's information while it walks the tape.
  let stagedLeftBit: 0 | 1 = 0;
  let stagedRightBit: 0 | 1 = 0;
  let stagedResultBit: 0 | 1 = 0;
  let stagedCarryIn: 0 | 1 = 0;

  // These indices remember where the temporary x and y marks were placed so they can be restored later.
  let markedLeftIndex: number | undefined;
  let markedRightIndex: number | undefined;

  /**
   * snapshot:
   * Packages up the machine's current configuration into a plain object for the UI.
   * The frontend uses this for rendering, highlighting, and explanatory callouts.
   *
   * message: A human-readable explanation of what just happened during this step.
   * transitionKind: The kind of step that occurred, such as move, mark, write, restore, compute, or halt.
   * highlightedIndex: The tape cell that should be visually emphasized in the UI for this snapshot.
   * columnRule: Optional arithmetic details for the current column, included when a binary-addition rule has been computed.
   */
  function snapshot(
    message: string,
    transitionKind: BinaryAdditionSnapshot["transitionKind"],
    highlightedIndex: number | undefined = head,
    columnRule: BinaryAdditionSnapshot["columnRule"] = undefined
  ): BinaryAdditionSnapshot {
    return {
      state,
      tape: [...tape],
      head,
      carry,
      columnRule,
      message,
      transitionKind,
      highlightedIndex,
      lastTransition,
      resultStart,
    };
  }

  /**
   * markLeftBit
   * Replaces the current left-side input bit with x so the machine can remember which left operand
   * cell it is currently using for this column.
   *
   * index: The tape index of the left-side bit being marked.
   *
   * Returns the original binary value, either 0 or 1, that was stored at that position.
   */
  function markLeftBit(index: number) {
    const bit = tape[index] === "1" ? 1 : 0;
    tape[index] = "x";
    return bit as 0 | 1;
  }

  /**
   * markRightBit
   * Replaces the current right-side input bit with y so the machine can remember which right operand
   * cell it is currently using for this column.
   *
   * index: The tape index of the right-side bit being marked.
   *
   * Returns the original binary value, either 0 or 1, that was stored at that position.
   */
  function markRightBit(index: number) {
    const bit = tape[index] === "1" ? 1 : 0;
    tape[index] = "y";
    return bit as 0 | 1;
  }

  /**
   * restoreMarker
   * Restores a tape cell that was temporarily changed to x or y back to its original binary symbol.
   *
   * index: The location of the temporary mark. If it is undefined, there was nothing to restore.
   * bit: The original binary value, either 0 or 1, that should be written back.
   */
  function restoreMarker(index: number | undefined, bit: 0 | 1) {
    if (index === undefined) {
      return;
    }

    tape[index] = String(bit);
  }

  /**
   * hasRemainingBits
   * Checks whether the machine still has any input columns left to process.
   *
   * leftCursor: Points at the next unread position in the left operand.
   * rightCursor: Points at the next unread position in the right operand.
   *
   * Returns true if either cursor is still inside its input region, and false otherwise.
   */
  function hasRemainingBits() {
    return leftCursor >= leftStart || rightCursor >= rightStart;
  }

  /**
   * moveHeadToward:
   * Performs exactly one tape-head movement toward a target index. If the head is already there,
   * the function returns undefined so the caller can perform the next non-movement action.
   *
   * target: The tape index the head is trying to reach.
   * transitionId: The diagram transition id that should be highlighted while this movement happens.
   * directionWord: A word like "left" or "right" that is inserted into the explanation message.
   */
  function moveHeadToward(target: number, transitionId: string, directionWord: string) {
    if (head < target) {
      head += 1;
      lastTransition = transitionId;
      return snapshot(`The head moves one cell ${directionWord}.`, "move", head);
    }

    if (head > target) {
      head -= 1;
      lastTransition = transitionId;
      return snapshot(`The head moves one cell ${directionWord}.`, "move", head);
    }

    return undefined;
  }

  /**
   * computeStagedResult
   * Computes the next binary result bit and carry from the currently staged left bit, right bit,
   * and carry value.
   *
   * stagedLeftBit: The left-side bit chosen for this column.
   * stagedRightBit: The right-side bit chosen for this column.
   * carry: The incoming carry currently stored in the control.
   *
   * Updates stagedCarryIn, stagedResultBit, and carry so later states can explain and write the result.
   */
  function computeStagedResult() {
    stagedCarryIn = carry;
    const total = stagedLeftBit + stagedRightBit + carry;
    stagedResultBit = (total % 2) as 0 | 1;
    carry = total >= 2 ? 1 : 0;
  }

  /**
   * currentColumnRule
   * Builds a structured summary of the current binary-addition column so the UI can explain
   * exactly why the machine writes a particular result bit and carry.
   *
   * Uses stagedLeftBit, stagedRightBit, stagedCarryIn, stagedResultBit, and carry.
   *
   * Returns an object containing the full arithmetic rule for the current column.
   */
  function currentColumnRule(): NonNullable<BinaryAdditionSnapshot["columnRule"]> {
    return {
      leftBit: stagedLeftBit,
      rightBit: stagedRightBit,
      carryIn: stagedCarryIn,
      resultBit: stagedResultBit,
      carryOut: carry,
    };
  }

  /**
   * step:
   * Executes one transition of the machine. Sometimes that transition is a move by one tape cell,
   * and sometimes it is a read/mark/write/restore action at the current position.
   *
   * state: The current control state, which decides which part of the algorithm runs next.
   * head: The tape-head position before and after this transition.
   * leftCursor, rightCursor, resultCursor: The current working positions in the left input, right input, and result zone.
   * stagedLeftBit, stagedRightBit, stagedResultBit, stagedCarryIn: Temporary values that store the current column's arithmetic while the head travels around the tape.
   * markedLeftIndex, markedRightIndex: The locations of the temporary x and y marks so they can be restored later.
   */
  function step(): BinaryAdditionSnapshot {
    if (state === "HALT") {
      lastTransition = undefined;
      return snapshot("The machine has halted.", "halt");
    }

    // State: SEEK_LEFT
    // Purpose: Move to the next relevant left-side bit, mark it with x if it exists, or use an implied 0.
    if (state === "SEEK_LEFT") {
      if (!hasRemainingBits()) {
        if (carry === 1) {
          state = "SEEK_FINAL_RESULT";
          lastTransition = "q0-q6";
          return snapshot(
            "No input bits remain, but the control state still carries 1. The head now walks to the result zone for a final write.",
            "compute"
          );
        }

        state = "HALT";
        lastTransition = "q0-halt";
        return snapshot(
          "Both inputs are exhausted and no carry remains, so the machine halts.",
          "halt"
        );
      }

      const leftTarget = leftCursor >= leftStart ? leftCursor : inputSeparatorIndex;
      const movement = moveHeadToward(leftTarget, "q5-q0", leftTarget < head ? "left" : "right");

      if (movement) {
        return movement;
      }

      if (leftCursor >= leftStart) {
        stagedLeftBit = markLeftBit(leftCursor);
        markedLeftIndex = leftCursor;
        state = "SEEK_RIGHT";
        lastTransition = "q0-q1";

        return snapshot(
          `The head marks the current left-side bit ${stagedLeftBit} as ${tape[leftCursor]}.`,
          "mark",
          leftCursor
        );
      }

      stagedLeftBit = 0;
      markedLeftIndex = undefined;
      state = "SEEK_RIGHT";
      lastTransition = "q0-q1";

      return snapshot(
        "The left input has no remaining bit here, so the machine uses an implied 0.",
        "compute",
        inputSeparatorIndex
      );
    }

    // State: SEEK_RIGHT
    // Purpose: Move to the matching right-side bit, mark it with y if it exists, and compute the column rule.
    if (state === "SEEK_RIGHT") {
      const rightTarget = rightCursor >= rightStart ? rightCursor : inputSeparatorIndex;
      const movement = moveHeadToward(rightTarget, "q1-scan", rightTarget > head ? "right" : "left");

      if (movement) {
        return movement;
      }

      if (rightCursor >= rightStart) {
        stagedRightBit = markRightBit(rightCursor);
        markedRightIndex = rightCursor;
      } else {
        stagedRightBit = 0;
        markedRightIndex = undefined;
      }

      computeStagedResult();
      state = "SEEK_RESULT";
      lastTransition = "q1-q2";

      return snapshot(
        markedRightIndex !== undefined
          ? `The head marks the current right-side bit ${stagedRightBit} as ${tape[rightCursor]}. The control now stores the next result bit ${stagedResultBit} and carry ${carry}.`
          : `The right input has no remaining bit here, so the control combines an implied 0 and stores result bit ${stagedResultBit} with carry ${carry}.`,
        markedRightIndex !== undefined ? "mark" : "compute",
        markedRightIndex ?? inputSeparatorIndex,
        currentColumnRule()
      );
    }

    // State: SEEK_RESULT
    // Purpose: Travel to the active result cell and write the staged result bit for this column.
    if (state === "SEEK_RESULT") {
      const movement = moveHeadToward(resultCursor, "q2-scan", resultCursor > head ? "right" : "left");

      if (movement) {
        return movement;
      }

      tape[resultCursor] = String(stagedResultBit);
      state = "SEEK_RIGHT_MARK";
      lastTransition = "q2-q3";

      return snapshot(
        `The head writes result bit ${stagedResultBit} into the current output cell.`,
        "write",
        resultCursor,
        currentColumnRule()
      );
    }

    // State: SEEK_RIGHT_MARK
    // Purpose: Return to the right-side mark and restore that input symbol back from y to its original bit.
    if (state === "SEEK_RIGHT_MARK") {
      const rightTarget = markedRightIndex ?? inputSeparatorIndex;
      const movement = moveHeadToward(rightTarget, "q3-scan", rightTarget < head ? "left" : "right");

      if (movement) {
        return movement;
      }

      if (markedRightIndex !== undefined) {
        restoreMarker(markedRightIndex, stagedRightBit);
      }

      state = "SEEK_LEFT_MARK";
      lastTransition = "q3-q4";

      return snapshot(
        markedRightIndex !== undefined
          ? "The head restores the marked right-side bit to its original value."
          : "There was no right-side mark to restore on this cycle.",
        "restore",
        rightTarget
      );
    }

    // State: SEEK_LEFT_MARK
    // Purpose: Return to the left-side mark, restore it, and then shift all cursors one column leftward.
    if (state === "SEEK_LEFT_MARK") {
      const leftTarget = markedLeftIndex ?? inputSeparatorIndex;
      const movement = moveHeadToward(leftTarget, "q4-scan", leftTarget < head ? "left" : "right");

      if (movement) {
        return movement;
      }

      if (markedLeftIndex !== undefined) {
        restoreMarker(markedLeftIndex, stagedLeftBit);
      }

      if (leftCursor >= leftStart) {
        leftCursor -= 1;
      }

      if (rightCursor >= rightStart) {
        rightCursor -= 1;
      }

      if (resultCursor > resultStart) {
        resultCursor -= 1;
      }

      markedLeftIndex = undefined;
      markedRightIndex = undefined;
      state = "SEEK_LEFT";
      lastTransition = "q4-q5";

      return snapshot(
        "The head restores the left-side bit and the machine shifts its attention one column toward the more significant side.",
        "restore",
        leftTarget
      );
    }

    // State: SEEK_FINAL_RESULT
    // Purpose: If a carry remains after both inputs are exhausted, move to the final result cell and write 1.
    const movement = moveHeadToward(resultCursor, "q6-scan", resultCursor > head ? "right" : "left");

    if (movement) {
      return movement;
    }

    tape[resultCursor] = "1";
    carry = 0;
    state = "HALT";
    lastTransition = "q6-halt";

    return snapshot(
      "The last carry is written as 1 in the result zone, and the machine halts.",
      "write",
      resultCursor
    );
  }

  /**
   * getResult:
   * Reads the result zone from the tape and turns it into the binary answer shown to the user.
   *
   * resultStart: The index where the result portion of the tape begins.
   * tape: The full tape contents, including blanks and separators.
   *
   * This is only used for the testing file, currently.
   *
   * Returns the result as a binary string after removing leading blank cells. If nothing has been
   * written yet, it returns "0".
   */
  function getResult() {
    const result = tape.slice(resultStart).join("").replace(/^_+/, "");
    return result || "0";
  }

  return {
    step,
    getResult,
    getSnapshot: () =>
      snapshot(
        "Initial single-tape configuration. The head starts on the left input and each click now performs one tiny transition.",
        "move"
      ),
    isHalted: () => state === "HALT",
  };
}
