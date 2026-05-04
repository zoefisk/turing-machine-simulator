"use client";

import type { FormEvent } from "react";

type InputMode = "binary" | "decimal";
type VisualizationMode = "diagram" | "tape";

type SetupInputPanelProps = {
  canLoad: boolean;
  draftInputs: {
    left: string;
    right: string;
  };
  inputError: string;
  inputMode: InputMode;
  loadButtonLabel: string;
  maxDecimalLength: number;
  maxDecimalValue: string;
  maxInputLength: number;
  onInputModeChange: (mode: InputMode) => void;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  visualizationMode: VisualizationMode;
};

export default function SetupInputPanel({
  canLoad,
  draftInputs,
  inputError,
  inputMode,
  loadButtonLabel,
  maxDecimalLength,
  maxDecimalValue,
  maxInputLength,
  onInputModeChange,
  onLeftChange,
  onRightChange,
  onSubmit,
  onVisualizationModeChange,
  visualizationMode,
}: SetupInputPanelProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-[var(--ink)] sm:px-6">
      <section className="lab-panel relative w-full max-w-xl px-6 py-7 sm:px-8 sm:py-8">
        <div className="space-y-3">
          <p className="ink-kicker text-xs">Turing Machine Binary Addition</p>
          <h1 className="text-3xl font-semibold uppercase tracking-[0.08em] sm:text-4xl">
            Enter Two Inputs
          </h1>
          <p className="max-w-lg text-sm leading-6 text-[var(--ink-soft)] sm:text-base">
            Choose binary or decimal input. Switching modes converts any
            existing values in the text boxes. The tape supports inputs up to{" "}
            {maxInputLength} binary characters, so decimal mode accepts values
            from 0 to {maxDecimalValue}.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--olive)]">
              Input Mode
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onInputModeChange("binary")}
                className={[
                  "machine-button rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em]",
                  inputMode === "binary" ? "" : "machine-button--secondary",
                ].join(" ")}
              >
                Binary
              </button>
              <button
                type="button"
                onClick={() => onInputModeChange("decimal")}
                className={[
                  "machine-button rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em]",
                  inputMode === "decimal" ? "" : "machine-button--secondary",
                ].join(" ")}
              >
                Decimal
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--olive)]">
              Visualization
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onVisualizationModeChange("tape")}
                className={[
                  "machine-button rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em]",
                  visualizationMode === "tape" ? "" : "machine-button--secondary",
                ].join(" ")}
              >
                Tape
              </button>
              <button
                type="button"
                onClick={() => onVisualizationModeChange("diagram")}
                className={[
                  "machine-button rounded-none px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em]",
                  visualizationMode === "diagram" ? "" : "machine-button--secondary",
                ].join(" ")}
              >
                Diagram
              </button>
            </div>
          </div>

          <label className="block">
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--olive)]">
              First input
            </span>
            <input
              type="text"
              autoComplete="off"
              inputMode="numeric"
              maxLength={inputMode === "binary" ? maxInputLength : maxDecimalLength}
              value={draftInputs.left}
              onChange={(event) => onLeftChange(event.target.value)}
              className="mt-1.5 w-full border border-[color:var(--rule)] bg-[rgba(250,245,230,0.72)] px-3 py-3 font-[family-name:var(--font-mono)] text-lg tracking-[0.12em] text-[var(--ink)] outline-none placeholder:text-[var(--olive-soft)] focus:border-[rgba(168,125,50,0.72)]"
              placeholder={inputMode === "binary" ? "1011" : "13"}
            />
          </label>

          <label className="block">
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--olive)]">
              Second input
            </span>
            <input
              type="text"
              autoComplete="off"
              inputMode="numeric"
              maxLength={inputMode === "binary" ? maxInputLength : maxDecimalLength}
              value={draftInputs.right}
              onChange={(event) => onRightChange(event.target.value)}
              className="mt-1.5 w-full border border-[color:var(--rule)] bg-[rgba(250,245,230,0.72)] px-3 py-3 font-[family-name:var(--font-mono)] text-lg tracking-[0.12em] text-[var(--ink)] outline-none placeholder:text-[var(--olive-soft)] focus:border-[rgba(168,125,50,0.72)]"
              placeholder={inputMode === "binary" ? "110" : "6"}
            />
          </label>

          {inputError ? (
            <p className="border border-[rgba(138,75,42,0.24)] bg-[rgba(173,110,70,0.08)] px-3 py-2 text-sm text-[color:#8a4b2a]">
              {inputError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canLoad}
            className="machine-button rounded-none px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loadButtonLabel}
          </button>
        </form>
      </section>
    </main>
  );
}
