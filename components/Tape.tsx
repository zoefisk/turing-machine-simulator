"use client";

import { useLayoutEffect, useRef, useState } from "react";

type TapeProps = {
  label: string;
  descriptor: string;
  cells: string[];
  headIndex: number;
  highlightedIndex?: number;
  followHead?: boolean;
  movementKey?: number;
  movementMs?: number;
  onMovementComplete?: (movementKey: number) => void;
  emphasized?: boolean;
  centered?: boolean;
  showMeta?: boolean;
  size?: "default" | "large";
};

export default function Tape({
  label,
  descriptor,
  cells,
  headIndex,
  highlightedIndex,
  followHead = false,
  movementKey = 0,
  movementMs = 250,
  onMovementComplete,
  emphasized = false,
  centered = false,
  showMeta = true,
  size = "default",
}: TapeProps) {
  const cellSize = size === "large" ? 64 : 48;
  const cellClassName =
    size === "large"
      ? "h-16 w-16 text-xl sm:h-18 sm:w-18 sm:text-2xl"
      : "h-12 w-12 text-lg";
  const hasVisibleHead = headIndex >= 0;
  const safeHeadIndex = hasVisibleHead ? headIndex : 0;
  const visibleHighlightedIndex =
    highlightedIndex !== undefined && highlightedIndex >= 0
      ? highlightedIndex
      : undefined;
  const emphasizedIndex = hasVisibleHead ? safeHeadIndex : visibleHighlightedIndex;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pointerLeft, setPointerLeft] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!hasVisibleHead) {
      return;
    }

    const updatePointerLeft = () => {
      const cell = cellRefs.current[safeHeadIndex];

      if (!cell) {
        setPointerLeft(safeHeadIndex * cellSize + cellSize / 2);
        return;
      }

      setPointerLeft(cell.offsetLeft + cell.offsetWidth / 2);
    };

    const frameId = window.requestAnimationFrame(updatePointerLeft);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updatePointerLeft();
          })
        : null;

    if (resizeObserver) {
      if (stripRef.current) {
        resizeObserver.observe(stripRef.current);
      }

      cellRefs.current.forEach((cell) => {
        if (cell) {
          resizeObserver.observe(cell);
        }
      });
    }

    window.addEventListener("resize", updatePointerLeft);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePointerLeft);
      resizeObserver?.disconnect();
    };
  }, [cellSize, cells.length, hasVisibleHead, safeHeadIndex]);

  useLayoutEffect(() => {
    if (!followHead || !hasVisibleHead) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const cell = cellRefs.current[safeHeadIndex];

      if (!container || !cell) {
        return;
      }
      const leftBuffer = 48;
      const rightBuffer = 48;
      const cellLeft = cell.offsetLeft;
      const cellRight = cellLeft + cell.offsetWidth;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;

      if (cellLeft < visibleLeft + leftBuffer) {
        container.scrollTo({
          left: Math.max(0, cellLeft - leftBuffer),
          behavior: movementMs > 0 ? "smooth" : "auto",
        });
        return;
      }

      if (cellRight > visibleRight - rightBuffer) {
        container.scrollTo({
          left: cellRight - container.clientWidth + rightBuffer,
          behavior: movementMs > 0 ? "smooth" : "auto",
        });
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [followHead, hasVisibleHead, movementMs, safeHeadIndex]);

  return (
    <div className="space-y-2">
      {showMeta ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className={[
                "font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.18em]",
                emphasized ? "text-[var(--brass)]" : "text-[var(--olive)]",
              ].join(" ")}
            >
              {label}
            </p>
            <p className="text-xs text-[var(--ink-soft)] sm:text-sm">{descriptor}</p>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--olive-soft)]">
            Head position: {hasVisibleHead ? safeHeadIndex : "off tape"}
          </p>
        </div>
      ) : null}

      <div
        className={[
          "border bg-[rgba(248,242,225,0.72)]",
          size === "large" ? "px-4 py-10" : "px-2 py-7 sm:px-3 sm:py-7",
          emphasized
            ? "border-[rgba(168,125,50,0.52)] shadow-[0_0_0_1px_rgba(255,244,214,0.48)_inset,0_10px_20px_rgba(168,125,50,0.12)]"
            : "border-[color:var(--rule)]",
        ].join(" ")}
      >
        <div
          ref={scrollContainerRef}
          className="relative w-full overflow-x-auto overflow-y-hidden"
        >
          <div
            ref={stripRef}
            className={["relative flex min-w-max", centered ? "mx-auto" : ""].join(" ")}
          >
          {cells.map((cell, index) => (
            <div
              key={index}
              ref={(node) => {
                cellRefs.current[index] = node;
              }}
              className={[
                "relative z-20 flex items-center justify-center",
                cellClassName,
                emphasizedIndex === index
                  ? "border-y border-r border-[rgba(138,98,29,0.62)] bg-[linear-gradient(180deg,#f4e2b3_0%,#ddb260_100%)]"
                  : "border-y border-r border-[rgba(92,72,37,0.42)] bg-[linear-gradient(180deg,#f7efd9_0%,#e6d5ac_100%)]",
                "font-[family-name:var(--font-mono)] font-bold tracking-[0.14em] text-[var(--ink)]",
                emphasizedIndex === index
                  ? "shadow-[0_0_0_1px_rgba(255,246,219,0.58)_inset,0_0_20px_rgba(168,125,50,0.22),inset_0_-2px_4px_rgba(67,49,20,0.08)]"
                  : "shadow-[inset_0_1px_0_rgba(255,252,241,0.72),inset_0_-2px_4px_rgba(67,49,20,0.08)]",
                index === 0 ? "border-l" : "",
              ].join(" ")}
            >
              {cell || "_"}

              <div className="absolute left-[5px] top-1.5 h-1 w-1 rounded-full bg-[rgba(84,67,39,0.28)]" />
              <div className="absolute right-[5px] top-1.5 h-1 w-1 rounded-full bg-[rgba(84,67,39,0.28)]" />
              <div className="absolute bottom-1.5 left-[5px] h-1 w-1 rounded-full bg-[rgba(84,67,39,0.28)]" />
              <div className="absolute bottom-1.5 right-[5px] h-1 w-1 rounded-full bg-[rgba(84,67,39,0.28)]" />
              <div className="absolute left-0 top-2 h-px w-full bg-[rgba(255,252,242,0.72)]" />
              <div className="absolute bottom-2 left-0 h-px w-full bg-[rgba(113,86,38,0.18)]" />
            </div>
          ))}

          {hasVisibleHead && pointerLeft !== null ? (
            <div
              className="absolute top-[calc(100%-2px)] z-30 flex w-8 -translate-x-1/2 flex-col items-center transition-[left]"
              onTransitionEnd={(event) => {
                if (
                  event.propertyName === "left" &&
                  movementKey > 0 &&
                  onMovementComplete
                ) {
                  onMovementComplete(movementKey);
                }
              }}
              style={{
                left: `${pointerLeft}px`,
                transitionDuration: `${movementMs}ms`,
                transitionTimingFunction: "linear",
              }}
            >
              <div className="h-4 w-8 border border-[rgba(61,46,20,0.58)] bg-[linear-gradient(180deg,#73694f_0%,#453a28_100%)] shadow-[0_4px_8px_rgba(38,28,12,0.22)]" />
              <div className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[14px] border-l-transparent border-r-transparent border-t-[rgba(69,58,40,0.96)]" />
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
