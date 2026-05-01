export type TMState =
    | "MOVE_TO_END"
    | "ADD0"
    | "ADD1"
    | "FINAL_CARRY"
    | "HALT";

export type Tape = {
    cells: string[];
    head: number;
};

export type TapeKey = "tape1" | "tape2" | "tape3";

export type StepPhase =
    | "ENTER_ADD_STATE"
    | "READ_TAPE1"
    | "READ_TAPE2"
    | "COMPUTE"
    | "WRITE_RESULT"
    | "ADVANCE_HEADS"
    | "WRITE_FINAL_CARRY"
    | "HALT_AFTER_FINAL_CARRY";

export type MachineSnapshot = {
    state: TMState;
    tape1: Tape;
    tape2: Tape;
    tape3: Tape;
    carry: 0 | 1;
    phase: StepPhase;
    message: string;
    activeTapes: TapeKey[];
    highlightedCells: Partial<Record<TapeKey, number>>;
    lastTransition?: string;
};

export function createBinaryAdditionMachine(input: string) {
    const [x, y] = input.split("#");
    const resultWidth = Math.max(x.length, y.length) + 1;

    let state: TMState = "MOVE_TO_END";
    let phase: StepPhase = "ENTER_ADD_STATE";

    const tape1: Tape = {
        cells: x.split(""),
        head: x.length - 1,
    };

    const tape2: Tape = {
        cells: y.split(""),
        head: y.length - 1,
    };

    const tape3: Tape = {
        cells: Array.from({ length: resultWidth }, () => "_"),
        head: resultWidth - 1,
    };

    let carry: 0 | 1 = 0;
    let lastTransition: string | undefined = undefined;

    let stagedBit1: 0 | 1 = 0;
    let stagedBit2: 0 | 1 = 0;
    let stagedResultBit: 0 | 1 = 0;
    let stagedOldCarry: 0 | 1 = 0;

    function getReadableHeadPosition(tape: Tape) {
        return tape.head >= 0 ? tape.head : undefined;
    }

    function snapshot(
        message: string,
        activeTapes: TapeKey[] = [],
        highlightedCells: Partial<Record<TapeKey, number>> = {}
    ): MachineSnapshot {
        return {
            state,
            tape1: {
                cells: [...tape1.cells],
                head: tape1.head,
            },
            tape2: {
                cells: [...tape2.cells],
                head: tape2.head,
            },
            tape3: {
                cells: [...tape3.cells],
                head: tape3.head,
            },
            carry,
            phase,
            message,
            activeTapes,
            highlightedCells,
            lastTransition,
        };
    }

    function readBit(tape: Tape): 0 | 1 {
        if (tape.head < 0) return 0;
        return tape.cells[tape.head] === "1" ? 1 : 0;
    }

    function writeResultBit(bit: 0 | 1) {
        tape3.cells[tape3.head] = String(bit);
        if (tape3.head > 0) {
            tape3.head -= 1;
        }
    }

    function advanceInputHeads() {
        tape1.head -= 1;
        tape2.head -= 1;
    }

    function getNextReadableTapeFocus():
        | { activeTape: TapeKey; index: number }
        | undefined {
        if (tape1.head >= 0) {
            return { activeTape: "tape1", index: tape1.head };
        }

        if (tape2.head >= 0) {
            return { activeTape: "tape2", index: tape2.head };
        }

        if (tape3.head >= 0) {
            return { activeTape: "tape3", index: tape3.head };
        }

        return undefined;
    }

    function step(): MachineSnapshot {
        if (state === "HALT") {
            lastTransition = undefined;
            return snapshot("Machine has halted.");
        }

        if (state === "MOVE_TO_END" && phase === "ENTER_ADD_STATE") {
            state = "ADD0";
            phase = "READ_TAPE1";
            lastTransition = "q0-q1";

            return snapshot(
                "The control enters q1 and prepares to inspect the least significant bit on Tape I.",
                ["tape1"],
                getReadableHeadPosition(tape1) !== undefined
                    ? { tape1: getReadableHeadPosition(tape1) }
                    : {}
            );
        }

        if (state === "FINAL_CARRY") {
            if (phase === "WRITE_FINAL_CARRY") {
                const writeIndex = tape3.head;
                writeResultBit(1);
                phase = "HALT_AFTER_FINAL_CARRY";

                return snapshot(
                    "q3 writes the final carry bit 1 onto the result tape.",
                    ["tape3"],
                    { tape3: writeIndex }
                );
            }

            carry = 0;
            state = "HALT";
            lastTransition = "q3-halt";

            return snapshot("The final carry has been recorded. The machine halts.");
        }

        if (phase === "READ_TAPE1") {
            if (tape1.head < 0 && tape2.head < 0) {
                if (carry === 1) {
                    state = "FINAL_CARRY";
                    phase = "WRITE_FINAL_CARRY";
                    lastTransition = "q2-q3";

                    return snapshot(
                        "The input tapes are exhausted, but carry 1 remains. The machine enters q3.",
                        ["tape3"],
                        { tape3: tape3.head }
                    );
                }

                state = "HALT";
                lastTransition = "q1-halt";

                return snapshot(
                    "The input tapes are exhausted and no carry remains. The machine halts."
                );
            }

            stagedBit1 = readBit(tape1);
            phase = "READ_TAPE2";

            return snapshot(
                `Tape I is read at head position ${Math.max(tape1.head, 0)} and yields bit ${stagedBit1}.`,
                ["tape1"],
                getReadableHeadPosition(tape1) !== undefined
                    ? { tape1: getReadableHeadPosition(tape1) }
                    : {}
            );
        }

        if (phase === "READ_TAPE2") {
            stagedBit2 = readBit(tape2);
            phase = "COMPUTE";

            return snapshot(
                `Tape II is read at head position ${Math.max(tape2.head, 0)} and yields bit ${stagedBit2}.`,
                ["tape2"],
                getReadableHeadPosition(tape2) !== undefined
                    ? { tape2: getReadableHeadPosition(tape2) }
                    : {}
            );
        }

        if (phase === "COMPUTE") {
            const previousState = state;
            stagedOldCarry = carry;

            const total = stagedBit1 + stagedBit2 + stagedOldCarry;
            stagedResultBit = (total % 2) as 0 | 1;
            carry = total >= 2 ? 1 : 0;
            state = carry === 1 ? "ADD1" : "ADD0";

            if (previousState === "ADD0" && state === "ADD0") {
                lastTransition = "q1-q1";
            } else if (previousState === "ADD0" && state === "ADD1") {
                lastTransition = "q1-q2";
            } else if (previousState === "ADD1" && state === "ADD0") {
                lastTransition = "q2-q1";
            } else if (previousState === "ADD1" && state === "ADD1") {
                lastTransition = "q2-q2";
            }

            phase = "WRITE_RESULT";

            return snapshot(
                `${stagedBit1} + ${stagedBit2} with carry ${stagedOldCarry} gives result bit ${stagedResultBit} and next carry ${carry}.`,
                ["tape3"],
                { tape3: tape3.head }
            );
        }

        if (phase === "WRITE_RESULT") {
            const writeIndex = tape3.head;
            writeResultBit(stagedResultBit);
            phase = "ADVANCE_HEADS";

            return snapshot(
                `The machine writes result bit ${stagedResultBit} onto Tape III.`,
                ["tape3"],
                { tape3: writeIndex }
            );
        }

        advanceInputHeads();
        phase = "READ_TAPE1";

        const nextFocus = getNextReadableTapeFocus();

        return snapshot(
            "The machine advances both input heads leftward to begin the next addition cycle.",
            nextFocus ? [nextFocus.activeTape] : [],
            nextFocus ? { [nextFocus.activeTape]: nextFocus.index } : {}
        );
    }

    function getResult(): string {
        const result = tape3.cells
            .join("")
            .replace(/_/g, "")
            .replace(/^0+(?=\d)/, "");

        return result || "0";
    }

    return {
        step,
        getResult,
        getSnapshot: () => snapshot("Initial configuration."),
        isHalted: () => state === "HALT",
    };
}
