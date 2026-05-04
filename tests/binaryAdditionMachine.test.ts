import assert from "node:assert/strict";
import test from "node:test";

import {
  createBinaryAdditionMachine,
  type BinaryAdditionSnapshot,
} from "../lib/turing/binaryAdditionMachine.ts";

function runUntilHalt(input: string) {
  const machine = createBinaryAdditionMachine(input);
  const snapshots: BinaryAdditionSnapshot[] = [machine.getSnapshot()];

  while (!machine.isHalted()) {
    snapshots.push(machine.step());
  }

  return {
    machine,
    snapshots,
    finalSnapshot: snapshots.at(-1)!,
  };
}

test("produces the correct binary sum across several inputs", async (t) => {
  const cases = [
    { input: "1011c110", expected: "10001" },
    { input: "1c0", expected: "1" },
    { input: "111c1", expected: "1000" },
    { input: "0011c0001", expected: "0100" },
    { input: "0101c0011", expected: "1000" },
    { input: "0000c0000", expected: "0000" },
  ];

  for (const { input, expected } of cases) {
    await t.test(input, () => {
      const { machine, finalSnapshot } = runUntilHalt(input);

      assert.equal(machine.getResult(), expected);
      assert.equal(finalSnapshot.state, "HALT");
    });
  }
});

test("writes the last carry into the result zone before halting", () => {
  const { snapshots, finalSnapshot } = runUntilHalt("1c1");

  const finalCarryStep = snapshots.find(
    (snapshot) => snapshot.lastTransition === "q6-halt"
  );

  assert.ok(finalCarryStep, "expected a final-carry write step");
  assert.equal(finalCarryStep.columnRule, undefined);
  assert.equal(finalSnapshot.tape.join(""), "1c1|10");
});

test("restores temporary markers before the machine halts", () => {
  const { finalSnapshot } = runUntilHalt("101c11");

  assert.match(finalSnapshot.tape.join(""), /^[01c|_]+$/);
  assert.equal(finalSnapshot.tape.includes("x"), false);
  assert.equal(finalSnapshot.tape.includes("y"), false);
});

test("uses x only for the left input and y only for the right input", () => {
  const machine = createBinaryAdditionMachine("101c11");

  const firstLeftMark = machine.step();
  assert.equal(firstLeftMark.transitionKind, "mark");
  assert.equal(firstLeftMark.tape.slice(0, 3).includes("x"), true);
  assert.equal(firstLeftMark.tape.slice(4, 6).includes("x"), false);

  let rightMark: BinaryAdditionSnapshot | undefined;

  while (!machine.isHalted()) {
    const snapshot = machine.step();

    if (snapshot.lastTransition === "q1-q2") {
      rightMark = snapshot;
      break;
    }
  }

  assert.ok(rightMark, "expected to reach the right-side marking step");
  assert.equal(rightMark.tape.slice(4, 6).includes("y"), true);
  assert.equal(rightMark.tape.slice(0, 3).includes("y"), false);
});

test("records the binary-addition rule for a computed column", () => {
  const machine = createBinaryAdditionMachine("1c1");
  let computedColumn: BinaryAdditionSnapshot | undefined;

  while (!machine.isHalted()) {
    const snapshot = machine.step();

    if (snapshot.columnRule) {
      computedColumn = snapshot;
      break;
    }
  }

  assert.ok(computedColumn, "expected to reach a step with a column rule");

  assert.deepEqual(computedColumn.columnRule, {
    leftBit: 1,
    rightBit: 1,
    carryIn: 0,
    resultBit: 0,
    carryOut: 1,
  });
});

test("treats missing bits on the shorter operand as implicit zeroes", () => {
  const { machine, snapshots } = runUntilHalt("10c1");

  const impliedZeroStep = snapshots.find(
    (snapshot) =>
      snapshot.transitionKind === "compute" &&
      snapshot.message.includes("implied 0")
  );

  assert.ok(impliedZeroStep, "expected an implied-zero computation step");
  assert.equal(machine.getResult(), "11");
});
