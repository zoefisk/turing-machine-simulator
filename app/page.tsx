"use client";

import type { FormEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import SetupInputPanel from "@/components/SetupInputPanel";
import StateDiagram from "@/components/StateDiagram";
import Tape from "@/components/Tape";
import {
  createSingleTapeAdditionMachine,
  type SingleTapeSnapshot,
} from "@/lib/turing/singleTapeAdditionMachine";

const MAX_INPUT_LENGTH = 9;
const MOVE_ANIMATION_MS = 250;
const MOVE_DWELL_MS = 250;
const SKIP_MOVEMENT_MS = 95;
const SKIP_MOVE_DWELL_MS = 45;
const SKIP_STEP_MS = 30;

type InputMode = "binary" | "decimal";
type VisualizationMode = "diagram" | "tape";

type Session = {
  machine: ReturnType<typeof createSingleTapeAdditionMachine>;
  snapshot: SingleTapeSnapshot;
};

type LoadedInput = {
  leftBinary: string;
  leftRaw: string;
  mode: InputMode;
  rightBinary: string;
  rightRaw: string;
  visualizationMode: VisualizationMode;
};

type InputConversionResult =
  | { kind: "success"; binary: string }
  | { error: string; kind: "error" };

type GuideStep = {
  body: string;
  target: RefObject<HTMLElement | null>;
  title: string;
};

type ActionCallout = {
  body: string;
  title: string;
};

function buildInitialPositionCallout(): ActionCallout {
  return {
    title: "Head Positioned For The First Column",
    body: "The machine begins with its head resting on the least-significant bit of the left input. Advance again to watch it start marking and processing that first column.",
  };
}

function buildColumnRuleSummary(snapshot: SingleTapeSnapshot) {
  if (!snapshot.columnRule) {
    return null;
  }

  return `${snapshot.columnRule.leftBit} + ${snapshot.columnRule.rightBit} + carry ${snapshot.columnRule.carryIn} = ${
    snapshot.columnRule.carryOut === 1
      ? `1${snapshot.columnRule.resultBit}`
      : `${snapshot.columnRule.resultBit}`
  }, so write ${snapshot.columnRule.resultBit} and carry ${snapshot.columnRule.carryOut}.`;
}

function buildSession(leftOperand: string, rightOperand: string): Session {
  const machine = createSingleTapeAdditionMachine(`${leftOperand}c${rightOperand}`);

  return {
    machine,
    snapshot: machine.getSnapshot(),
  };
}

function buildSessionAtStepCount(
  leftOperand: string,
  rightOperand: string,
  stepCount: number
): Session {
  const machine = createSingleTapeAdditionMachine(`${leftOperand}c${rightOperand}`);
  let snapshot = machine.getSnapshot();

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    snapshot = machine.step();
  }

  return {
    machine,
    snapshot,
  };
}

function convertInput(rawValue: string, mode: InputMode): InputConversionResult {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return { error: "Enter a value in both boxes.", kind: "error" };
  }

  if (trimmedValue.length > MAX_INPUT_LENGTH) {
    return {
      error: `Keep each input under ${MAX_INPUT_LENGTH + 1} characters.`,
      kind: "error",
    };
  }

  if (mode === "binary") {
    if (!/^[01]+$/.test(trimmedValue)) {
      return { error: "Binary mode only accepts 0s and 1s.", kind: "error" };
    }

    return { binary: trimmedValue, kind: "success" };
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return {
      error: "Decimal mode only accepts whole numbers.",
      kind: "error",
    };
  }

  return {
    binary: BigInt(trimmedValue).toString(2),
    kind: "success",
  };
}

function buildSpotlightStyle(target: HTMLElement | null) {
  if (!target) {
    return null;
  }

  const rect = target.getBoundingClientRect();

  return {
    height: rect.height + 16,
    left: rect.left - 8,
    top: rect.top - 8,
    width: rect.width + 16,
  };
}

function buildActionCallout(snapshot: SingleTapeSnapshot): ActionCallout {
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
      title: columnRuleSummary ? "Reading And Computing This Column" : "Marking The Current Bit",
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
      title: columnRuleSummary ? "Applying The Binary Addition Rule" : "Updating The Control State",
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

function sanitizeNumericInput(rawValue: string) {
  return rawValue.replace(/[^0-9]/g, "");
}

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("binary");
  const [visualizationMode, setVisualizationMode] =
    useState<VisualizationMode>("tape");
  const [draftInputs, setDraftInputs] = useState({
    left: "",
    right: "",
  });
  const [inputError, setInputError] = useState("");
  const [loadedInput, setLoadedInput] = useState<LoadedInput | null>(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [movementKey, setMovementKey] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [actionCallout, setActionCallout] = useState<ActionCallout | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [showInitialHead, setShowInitialHead] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [guidePhase, setGuidePhase] = useState<"simulator" | null>(null);
  const [guideIndex, setGuideIndex] = useState(0);
  const moveTimeoutRef = useRef<number | null>(null);
  const skipTimeoutRef = useRef<number | null>(null);
  const transitionCountRef = useRef(0);
  const isMovingRef = useRef(false);
  const movementKeyRef = useRef(0);
  const actionStepCountsRef = useRef<number[]>([0]);
  const currentActionIndexRef = useRef(0);
  const pendingMoveModeRef = useRef<"advance" | "skip" | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const tapePanelRef = useRef<HTMLDivElement | null>(null);
  const diagramPanelRef = useRef<HTMLDivElement | null>(null);
  const diagramSummaryRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  const simulatorGuideSteps = useMemo<GuideStep[]>(
    () =>
      loadedInput?.visualizationMode === "diagram"
        ? [
            {
              title: "This is the active state diagram",
              body: "The highlighted node shows the control state the machine is currently in, and the brighter arrow shows the last transition it just took.",
              target: diagramPanelRef,
            },
            {
              title: "Use the register readout to stay oriented",
              body: "This summary keeps the original left input, right input, carry rule, and current result progress visible so you can follow the computation without switching back to the tape.",
              target: diagramSummaryRef,
            },
            {
              title: "Use the controls underneath",
              body: "Advance steps through the machine, Skip runs the rest very quickly, Reset restarts this input, and Change Input takes you back to the setup screen.",
              target: controlsRef,
            },
          ]
        : [
            {
              title: "This is the whole working tape",
              body: "The head moves across this one tape, rewrites symbols directly on it, and eventually leaves the final result on the right side.",
              target: tapePanelRef,
            },
            {
              title: "Watch for separators and temporary markers",
              body: "The `c` splits the two inputs, the `|` starts the result zone, `x` marks the current left-side bit, and `y` marks the current right-side bit while the machine works.",
              target: tapePanelRef,
            },
            {
              title: "Use the controls underneath",
              body: "Advance steps through the machine, Skip runs the rest very quickly, Reset restarts this input, and Change Input takes you back to the setup screen.",
              target: controlsRef,
            },
          ],
    [loadedInput?.visualizationMode]
  );

  const currentGuideSteps = guidePhase === "simulator" ? simulatorGuideSteps : [];
  const currentGuideStep = guidePhase ? currentGuideSteps[guideIndex] : undefined;
  const canLoadWorkingTape =
    draftInputs.left.trim().length > 0 && draftInputs.right.trim().length > 0;
  const loadButtonLabel =
    visualizationMode === "diagram" ? "Load Diagram View" : "Load Tape View";

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  function resetActionHistory() {
    transitionCountRef.current = 0;
    actionStepCountsRef.current = [0];
    currentActionIndexRef.current = 0;
    setCurrentActionIndex(0);
  }

  function commitActionBoundary(stepCount: number) {
    const baseHistory = actionStepCountsRef.current.slice(
      0,
      currentActionIndexRef.current + 1
    );

    if (baseHistory[baseHistory.length - 1] === stepCount) {
      return;
    }

    const nextHistory = [...baseHistory, stepCount];

    actionStepCountsRef.current = nextHistory;
    currentActionIndexRef.current = nextHistory.length - 1;
    setCurrentActionIndex(nextHistory.length - 1);
  }

  useEffect(() => {
    return () => {
      if (moveTimeoutRef.current !== null) {
        window.clearTimeout(moveTimeoutRef.current);
      }

      if (skipTimeoutRef.current !== null) {
        window.clearTimeout(skipTimeoutRef.current);
      }
    };
  }, []);

  function clearTimers() {
    if (moveTimeoutRef.current !== null) {
      window.clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = null;
    }

    if (skipTimeoutRef.current !== null) {
      window.clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = null;
    }

    pendingMoveModeRef.current = null;
  }

  function handleApplyInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const leftConversion = convertInput(draftInputs.left, inputMode);
    const rightConversion = convertInput(draftInputs.right, inputMode);

    if (leftConversion.kind === "error") {
      setInputError(leftConversion.error);
      return;
    }

    if (rightConversion.kind === "error") {
      setInputError(rightConversion.error);
      return;
    }

    const nextLoadedInput: LoadedInput = {
      leftBinary: leftConversion.binary,
      leftRaw: draftInputs.left.trim(),
      mode: inputMode,
      rightBinary: rightConversion.binary,
      rightRaw: draftInputs.right.trim(),
      visualizationMode,
    };
    const nextSession = buildSession(
      nextLoadedInput.leftBinary,
      nextLoadedInput.rightBinary
    );

    clearTimers();
    setLoadedInput(nextLoadedInput);
    sessionRef.current = nextSession;
    setSession(nextSession);
    setIsAnimatingMove(false);
    setIsSkipping(false);
    isMovingRef.current = false;
    resetActionHistory();
    movementKeyRef.current = 0;
    setMovementKey(0);
    setActionCallout(null);
    setShowInitialHead(false);
    setInputError("");
    setShowSetup(false);
    setGuidePhase("simulator");
    setGuideIndex(0);
  }

  function handleReset() {
    if (!loadedInput) {
      return;
    }

    clearTimers();
    setIsAnimatingMove(false);
    setIsSkipping(false);
    isMovingRef.current = false;
    resetActionHistory();
    movementKeyRef.current = 0;
    setMovementKey(0);
    const nextSession = buildSession(loadedInput.leftBinary, loadedInput.rightBinary);
    sessionRef.current = nextSession;
    setSession(nextSession);
    setActionCallout(null);
    setShowInitialHead(false);
  }

  function queueSkipStep(delay: number) {
    skipTimeoutRef.current = window.setTimeout(() => {
      skipTimeoutRef.current = null;
      runStep("skip");
    }, delay);
  }

  function queueMoveContinuation(mode: "advance" | "skip", delay: number) {
    moveTimeoutRef.current = window.setTimeout(() => {
      moveTimeoutRef.current = null;
      runStep(mode);
    }, delay);
  }

  function runStep(mode: "advance" | "skip" = "advance") {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      setIsAnimatingMove(false);
      setIsSkipping(false);
      isMovingRef.current = false;
      return;
    }

    const nextSnapshot = currentSession.machine.step();
    transitionCountRef.current += 1;
    const nextSession = {
      machine: currentSession.machine,
      snapshot: nextSnapshot,
    };

    sessionRef.current = nextSession;
    setSession(nextSession);

    if (nextSnapshot.transitionKind !== "move") {
      pendingMoveModeRef.current = null;
      isMovingRef.current = false;
      setIsAnimatingMove(false);
      commitActionBoundary(transitionCountRef.current);
      setActionCallout(buildActionCallout(nextSnapshot));

      if (mode === "skip") {
        if (nextSnapshot.state === "HALT") {
          setIsSkipping(false);
          skipTimeoutRef.current = null;
          return;
        }

        queueSkipStep(SKIP_STEP_MS);
      }

      return;
    }

    if (!isMovingRef.current) {
      setActionCallout(buildActionCallout(nextSnapshot));
    }

    isMovingRef.current = true;
    setIsAnimatingMove(true);
    clearTimers();
    pendingMoveModeRef.current = mode;

    if (loadedInput?.visualizationMode === "diagram") {
      queueMoveContinuation(
        mode,
        (mode === "skip" ? SKIP_MOVEMENT_MS + SKIP_MOVE_DWELL_MS : MOVE_ANIMATION_MS + MOVE_DWELL_MS)
      );
      return;
    }

    const nextMovementKey = movementKeyRef.current + 1;
    movementKeyRef.current = nextMovementKey;
    setMovementKey(nextMovementKey);
  }

  function handleStep() {
    if (isAnimatingMove || isSkipping || guidePhase) {
      return;
    }

    if (!showInitialHead && currentActionIndexRef.current === 0) {
      setShowInitialHead(true);
      setActionCallout(buildInitialPositionCallout());
      return;
    }

    runStep("advance");
  }

  function handleSkip() {
    if (isAnimatingMove || isSkipping || guidePhase) {
      return;
    }

    clearTimers();
    setIsAnimatingMove(false);
    setIsSkipping(true);
    runStep("skip");
  }

  function handleFinishNow() {
    if (!isSkipping) {
      return;
    }

    clearTimers();
    setIsAnimatingMove(false);
    setIsSkipping(false);
    isMovingRef.current = false;
    pendingMoveModeRef.current = null;
    movementKeyRef.current = 0;
    setMovementKey(0);

    const currentSession = sessionRef.current;

    if (!currentSession) {
      return;
    }

    let nextSnapshot = currentSession.snapshot;

    while (nextSnapshot.state !== "HALT") {
      nextSnapshot = currentSession.machine.step();
      transitionCountRef.current += 1;

      if (nextSnapshot.transitionKind !== "move") {
        commitActionBoundary(transitionCountRef.current);
      }
    }

    const nextSession = {
      machine: currentSession.machine,
      snapshot: nextSnapshot,
    };

    sessionRef.current = nextSession;
    setSession(nextSession);
    setActionCallout(buildActionCallout(nextSnapshot));
  }

  function handleTapeMovementComplete(completedMovementKey: number) {
    if (
      completedMovementKey !== movementKeyRef.current ||
      !pendingMoveModeRef.current
    ) {
      return;
    }

    const mode = pendingMoveModeRef.current;
    pendingMoveModeRef.current = null;

    queueMoveContinuation(
      mode,
      mode === "skip" ? SKIP_MOVE_DWELL_MS : MOVE_DWELL_MS
    );
  }

  function handleBack() {
    if (
      controlsLocked ||
      !loadedInput ||
      (currentActionIndexRef.current === 0 && !showInitialHead)
    ) {
      return;
    }

    if (currentActionIndexRef.current === 0 && showInitialHead) {
      clearTimers();
      setIsAnimatingMove(false);
      setIsSkipping(false);
      isMovingRef.current = false;
      movementKeyRef.current = 0;
      setMovementKey(0);
      setShowInitialHead(false);
      setActionCallout(null);
      return;
    }

    clearTimers();
    setIsAnimatingMove(false);
    setIsSkipping(false);
    isMovingRef.current = false;
    movementKeyRef.current = 0;
    setMovementKey(0);

    const nextActionIndex = currentActionIndexRef.current - 1;
    const targetStepCount = actionStepCountsRef.current[nextActionIndex] ?? 0;
    const nextSession = buildSessionAtStepCount(
      loadedInput.leftBinary,
      loadedInput.rightBinary,
      targetStepCount
    );

    transitionCountRef.current = targetStepCount;
    currentActionIndexRef.current = nextActionIndex;
    setCurrentActionIndex(nextActionIndex);
    sessionRef.current = nextSession;
    setSession(nextSession);
    setActionCallout(
      nextActionIndex === 0
        ? showInitialHead
          ? buildInitialPositionCallout()
          : null
        : buildActionCallout(nextSession.snapshot)
    );
  }

  function handleStartOver() {
    clearTimers();
    setShowSetup(true);
    setIsAnimatingMove(false);
    setIsSkipping(false);
    isMovingRef.current = false;
    setInputError("");
    setActionCallout(null);
    setGuidePhase(null);
    setGuideIndex(0);
    setDraftInputs({
      left: loadedInput?.leftRaw ?? draftInputs.left,
      right: loadedInput?.rightRaw ?? draftInputs.right,
    });
    setInputMode(loadedInput?.mode ?? inputMode);
    setVisualizationMode(loadedInput?.visualizationMode ?? visualizationMode);
  }

  function handleNextGuide() {
    if (!guidePhase) {
      return;
    }

    if (guideIndex >= currentGuideSteps.length - 1) {
      setGuidePhase(null);
      setGuideIndex(0);
      return;
    }

    setGuideIndex((currentValue) => currentValue + 1);
  }

  function handlePreviousGuide() {
    setGuideIndex((currentValue) => Math.max(0, currentValue - 1));
  }

  function handleDismissGuide() {
    setGuidePhase(null);
    setGuideIndex(0);
  }

  if (showSetup || !session || !loadedInput) {
    return (
      <SetupInputPanel
        canLoad={canLoadWorkingTape}
        draftInputs={draftInputs}
        inputError={inputError}
        inputMode={inputMode}
        loadButtonLabel={loadButtonLabel}
        maxInputLength={MAX_INPUT_LENGTH}
        onInputModeChange={setInputMode}
        onLeftChange={(value) =>
          setDraftInputs((currentValue) => ({
            ...currentValue,
            left: sanitizeNumericInput(value),
          }))
        }
        onRightChange={(value) =>
          setDraftInputs((currentValue) => ({
            ...currentValue,
            right: sanitizeNumericInput(value),
          }))
        }
        onSubmit={handleApplyInput}
        onVisualizationModeChange={setVisualizationMode}
        visualizationMode={visualizationMode}
      />
    );
  }

  const { snapshot } = session;
  const hasHalted = snapshot.state === "HALT";
  const diagramRefreshToken = `${loadedInput.leftBinary}-${loadedInput.rightBinary}`;
  const guideTarget = currentGuideStep?.target.current ?? null;
  const spotlightStyle = guidePhase ? buildSpotlightStyle(guideTarget) : null;
  const activeMovementMs = isSkipping ? SKIP_MOVEMENT_MS : MOVE_ANIMATION_MS;
  const controlsLocked = isAnimatingMove || isSkipping || guidePhase !== null;
  const hasStarted = showInitialHead || currentActionIndex > 0;
  const diagramResultCells = snapshot.tape.slice(snapshot.resultStart);
  const diagramResultBinary = diagramResultCells.join("").replace(/^_+/, "") || "0";
  const diagramResultProgress = diagramResultCells
    .map((cell) => (cell === "_" ? "·" : cell))
    .join("");
  const diagramRuleSummary =
    buildColumnRuleSummary(snapshot) ??
    (hasStarted
      ? "The machine is still moving to the next read, restore, or write position."
      : "Advance once to begin stepping through the first column.");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6 text-[var(--ink)] sm:px-6">
      <div className="w-full max-w-6xl">
        <section className="lab-panel relative px-4 py-6 sm:px-8 sm:py-8">
          {loadedInput.visualizationMode === "diagram" ? (
            <div
              ref={diagramPanelRef}
              className="mx-auto flex w-full min-w-0 max-w-6xl flex-col items-center gap-5"
            >
              <div
                ref={diagramSummaryRef}
                className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)]"
              >
                <div className="border border-[color:var(--rule)] bg-[rgba(251,246,232,0.9)] px-4 py-3 shadow-[0_8px_18px_rgba(70,52,21,0.08)]">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                    Left Input
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold tracking-[0.16em] text-[var(--ink)]">
                    {loadedInput.leftBinary}
                  </p>
                </div>
                <div className="border border-[color:var(--rule)] bg-[rgba(251,246,232,0.9)] px-4 py-3 shadow-[0_8px_18px_rgba(70,52,21,0.08)]">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                    Right Input
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold tracking-[0.16em] text-[var(--ink)]">
                    {loadedInput.rightBinary}
                  </p>
                </div>
                <div className="border border-[color:var(--rule)] bg-[rgba(251,246,232,0.9)] px-4 py-3 shadow-[0_8px_18px_rgba(70,52,21,0.08)]">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                    Result So Far
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold tracking-[0.16em] text-[var(--ink)]">
                    {diagramResultBinary}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive-soft)]">
                    Zone: {diagramResultProgress}
                  </p>
                </div>
                <div className="border border-[color:var(--rule)] bg-[rgba(251,246,232,0.9)] px-4 py-3 shadow-[0_8px_18px_rgba(70,52,21,0.08)]">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                    Current Rule
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    {diagramRuleSummary}
                  </p>
                </div>
              </div>
              <StateDiagram
                key={diagramRefreshToken}
                currentState={hasStarted ? snapshot.state : undefined}
                lastTransition={hasStarted ? snapshot.lastTransition : undefined}
                refreshToken={diagramRefreshToken}
              />
            </div>
          ) : (
            <div
              ref={tapePanelRef}
              className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center"
            >
              <Tape
                label="Working Tape"
                descriptor="left input c right input | result zone"
                cells={snapshot.tape}
                headIndex={hasStarted ? snapshot.head : -1}
                highlightedIndex={hasStarted ? snapshot.highlightedIndex : undefined}
                followHead
                movementKey={movementKey}
                movementMs={activeMovementMs}
                onMovementComplete={handleTapeMovementComplete}
                emphasized
                centered
                showMeta={false}
                size="large"
              />
            </div>
          )}

          {actionCallout && !isSkipping ? (
            <div className="mx-auto mt-5 w-full max-w-3xl border border-[rgba(79,58,24,0.32)] bg-[rgba(251,246,232,0.96)] px-5 py-4 shadow-[0_14px_28px_rgba(52,38,14,0.12)]">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                Current Action
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
                {actionCallout.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                {actionCallout.body}
              </p>
            </div>
          ) : null}

          <div
            ref={controlsRef}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <button
              onClick={handleStartOver}
              disabled={controlsLocked}
              className="machine-button machine-button--secondary rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Change Input
            </button>
            <button
              onClick={handleReset}
              disabled={controlsLocked}
              className="machine-button machine-button--secondary rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setGuidePhase("simulator");
                setGuideIndex(0);
              }}
              disabled={controlsLocked}
              className="machine-button machine-button--secondary rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Help
            </button>
            <button
              onClick={handleBack}
              disabled={currentActionIndex === 0 || controlsLocked}
              className="machine-button machine-button--secondary rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Back
            </button>
            <button
              onClick={handleStep}
              disabled={hasHalted || controlsLocked}
              className="machine-button rounded-none px-5 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isAnimatingMove ? "Moving..." : "Advance"}
            </button>
            <button
              onClick={handleSkip}
              disabled={hasHalted || controlsLocked}
              className="machine-button rounded-none px-5 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSkipping ? "Skipping..." : "Skip"}
            </button>
            {isSkipping ? (
              <button
                onClick={handleFinishNow}
                className="machine-button rounded-none px-5 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em]"
              >
                Give Me My Answer Now!
              </button>
            ) : null}
          </div>

          {guidePhase === "simulator" ? (
            <>
              {spotlightStyle ? (
                <div
                  className="pointer-events-none fixed z-50 rounded-sm border-[3px] border-[rgba(208,175,105,0.98)] shadow-[0_0_0_9999px_rgba(31,26,18,0.18),0_0_30px_rgba(208,175,105,0.18)]"
                  style={spotlightStyle}
                />
              ) : null}
              <div className="fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-2rem))] border-2 border-[rgba(79,58,24,0.5)] bg-[rgba(251,246,232,0.99)] p-5 shadow-[0_24px_48px_rgba(52,38,14,0.3)]">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive)]">
                  Guide {guideIndex + 1} / {currentGuideSteps.length}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
                  {currentGuideStep?.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  {currentGuideStep?.body}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDismissGuide}
                    className="machine-button machine-button--secondary rounded-none px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em]"
                  >
                    Skip Tour
                  </button>
                  {guideIndex > 0 ? (
                    <button
                      type="button"
                      onClick={handlePreviousGuide}
                      className="machine-button machine-button--secondary rounded-none px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em]"
                    >
                      Back
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleNextGuide}
                    className="machine-button rounded-none px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em]"
                  >
                    {guideIndex === currentGuideSteps.length - 1 ? "Done" : "Next"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        {loadedInput.visualizationMode === "tape" ? (
          <div className="hidden">
            <StateDiagram
              key={diagramRefreshToken}
              currentState={hasStarted ? snapshot.state : undefined}
              lastTransition={hasStarted ? snapshot.lastTransition : undefined}
              refreshToken={diagramRefreshToken}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
