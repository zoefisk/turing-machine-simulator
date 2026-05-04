import type { BinaryAdditionSnapshot } from "@/lib/turing/binaryAdditionMachine";

export const pageContent = {
  tape: {
    descriptor: "left input c right input | result zone",
    label: "Working Tape",
  },
  diagram: {
    currentRuleLabel: "Current Rule",
    idleRule: "Advance once to begin stepping through the first column.",
    leftInputLabel: "Left Input",
    movingRule:
      "The machine is still moving to the next read, restore, or write position.",
    resultProgressLabel: "Zone",
    resultSoFarLabel: "Result So Far",
    rightInputLabel: "Right Input",
  },
  actionPanel: {
    label: "Current Action",
  },
  controls: {
    advance: "Advance",
    back: "Back",
    changeInput: "Change Input",
    finishNow: "Give Me My Answer Now!",
    help: "Help",
    moving: "Moving...",
    reset: "Reset",
    skip: "Skip",
    skipping: "Skipping...",
  },
  guide: {
    back: "Back",
    done: "Done",
    next: "Next",
    skipTour: "Skip Tour",
    stepLabel: (current: number, total: number) => `Guide ${current} / ${total}`,
    diagramSteps: [
      {
        body: "The highlighted node shows the control state the machine is currently in, and the brighter arrow shows the last transition it just took.",
        title: "This is the active state diagram",
      },
      {
        body: "This summary keeps the original left input, right input, carry rule, and current result progress visible so you can follow the computation without switching back to the tape.",
        title: "Use the register readout to stay oriented",
      },
      {
        body: "Advance steps through the machine, Skip runs the rest very quickly, Reset restarts this input, and Change Input takes you back to the setup screen.",
        title: "Use the controls underneath",
      },
    ],
    tapeSteps: [
      {
        body: "The head moves across this one tape, rewrites symbols directly on it, and eventually leaves the final result on the right side.",
        title: "This is the whole working tape",
      },
      {
        body: "The `c` splits the two inputs, the `|` starts the result zone, `x` marks the current left-side bit, and `y` marks the current right-side bit while the machine works.",
        title: "Watch for separators and temporary markers",
      },
      {
        body: "Advance steps through the machine, Skip runs the rest very quickly, Reset restarts this input, and Change Input takes you back to the setup screen.",
        title: "Use the controls underneath",
      },
    ],
  },
} as const;

export function buildInitialPositionCallout() {
  return {
    title: "Head Positioned For The First Column",
    body: "The machine begins with its head resting on the least-significant bit of the left input. Advance again to watch it start marking and processing that first column.",
  };
}

export function buildColumnRuleSummary(snapshot: BinaryAdditionSnapshot) {
  if (!snapshot.columnRule) {
    return null;
  }

  return `${snapshot.columnRule.leftBit} + ${snapshot.columnRule.rightBit} + carry ${snapshot.columnRule.carryIn} = ${
    snapshot.columnRule.carryOut === 1
      ? `1${snapshot.columnRule.resultBit}`
      : `${snapshot.columnRule.resultBit}`
  }, so write ${snapshot.columnRule.resultBit} and carry ${snapshot.columnRule.carryOut}.`;
}

export function buildActionCallout(snapshot: BinaryAdditionSnapshot) {
  const columnRuleSummary = buildColumnRuleSummary(snapshot);

  if (snapshot.transitionKind === "move") {
    const direction = snapshot.message.includes("left") ? "left" : "right";

    return {
      title: "Scanning Across The Tape",
      body: `The head is traveling ${direction} to reach the next symbol it needs to inspect, restore, or write.`,
    };
  }

  if (snapshot.transitionKind === "mark") {
    return {
      title: columnRuleSummary
        ? "Reading And Computing This Column"
        : "Marking The Current Bit",
      body: columnRuleSummary
        ? `${snapshot.message} The rule for this column is: ${columnRuleSummary}`
        : snapshot.message,
    };
  }

  if (snapshot.transitionKind === "write") {
    return {
      title: "Writing To The Result Zone",
      body: columnRuleSummary
        ? `${snapshot.message} ${columnRuleSummary}`
        : snapshot.message,
    };
  }

  if (snapshot.transitionKind === "restore") {
    return {
      title: "Restoring The Tape",
      body: snapshot.message,
    };
  }

  if (snapshot.transitionKind === "compute") {
    return {
      title: columnRuleSummary
        ? "Applying The Binary Addition Rule"
        : "Updating The Control State",
      body: columnRuleSummary
        ? `${snapshot.message} The rule for this column is: ${columnRuleSummary}`
        : snapshot.message,
    };
  }

  return {
    title: "Machine Halted",
    body: snapshot.message,
  };
}
