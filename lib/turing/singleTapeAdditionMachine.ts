export type SingleTapeState =
  | "SEEK_LEFT"
  | "SEEK_RIGHT"
  | "SEEK_RESULT"
  | "SEEK_RIGHT_MARK"
  | "SEEK_LEFT_MARK"
  | "SEEK_FINAL_RESULT"
  | "HALT";

export type SingleTapeSnapshot = {
  state: SingleTapeState;
  tape: string[];
  head: number;
  carry: 0 | 1;
  columnRule?: {
    carryIn: 0 | 1;
    carryOut: 0 | 1;
    leftBit: 0 | 1;
    resultBit: 0 | 1;
    rightBit: 0 | 1;
  };
  message: string;
  transitionKind: "compute" | "halt" | "mark" | "move" | "restore" | "write";
  highlightedIndex?: number;
  lastTransition?: string;
  resultStart: number;
};

export function createSingleTapeAdditionMachine(input: string) {
  const [leftOperand = "", rightOperand = ""] = input.split("c");
  const resultWidth = Math.max(leftOperand.length, rightOperand.length) + 1;
  const tape = [
    ...leftOperand.split(""),
    "c",
    ...rightOperand.split(""),
    "|",
    ...Array.from({ length: resultWidth }, () => "_"),
  ];

  const leftStart = 0;
  const leftEnd = leftOperand.length - 1;
  const inputSeparatorIndex = leftOperand.length;
  const rightStart = inputSeparatorIndex + 1;
  const rightEnd = rightStart + rightOperand.length - 1;
  const resultSeparatorIndex = rightEnd + 1;
  const resultStart = resultSeparatorIndex + 1;

  let leftCursor = leftEnd;
  let rightCursor = rightEnd;
  let resultCursor = resultStart + resultWidth - 1;

  let head = leftEnd >= leftStart ? leftEnd : inputSeparatorIndex;
  let state: SingleTapeState = "SEEK_LEFT";
  let carry: 0 | 1 = 0;
  let lastTransition: string | undefined = "start-q0";

  let stagedLeftBit: 0 | 1 = 0;
  let stagedRightBit: 0 | 1 = 0;
  let stagedResultBit: 0 | 1 = 0;
  let stagedCarryIn: 0 | 1 = 0;

  let markedLeftIndex: number | undefined;
  let markedRightIndex: number | undefined;

  function snapshot(
    message: string,
    transitionKind: SingleTapeSnapshot["transitionKind"],
    highlightedIndex: number | undefined = head,
    columnRule: SingleTapeSnapshot["columnRule"] = undefined
  ): SingleTapeSnapshot {
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

  function markLeftBit(index: number) {
    const bit = tape[index] === "1" ? 1 : 0;
    tape[index] = "x";
    return bit as 0 | 1;
  }

  function markRightBit(index: number) {
    const bit = tape[index] === "1" ? 1 : 0;
    tape[index] = "y";
    return bit as 0 | 1;
  }

  function restoreMarker(index: number | undefined, bit: 0 | 1) {
    if (index === undefined) {
      return;
    }

    tape[index] = String(bit);
  }

  function hasRemainingBits() {
    return leftCursor >= leftStart || rightCursor >= rightStart;
  }

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

  function computeStagedResult() {
    stagedCarryIn = carry;
    const total = stagedLeftBit + stagedRightBit + carry;
    stagedResultBit = (total % 2) as 0 | 1;
    carry = total >= 2 ? 1 : 0;
  }

  function currentColumnRule(): NonNullable<SingleTapeSnapshot["columnRule"]> {
    return {
      leftBit: stagedLeftBit,
      rightBit: stagedRightBit,
      carryIn: stagedCarryIn,
      resultBit: stagedResultBit,
      carryOut: carry,
    };
  }

  function step(): SingleTapeSnapshot {
    if (state === "HALT") {
      lastTransition = undefined;
      return snapshot("The machine has halted.", "halt");
    }

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
