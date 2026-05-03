"use client";

import { useEffect } from "react";

import {
  Background,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type BuiltInEdge,
  type Node,
} from "@xyflow/react";

import type { SingleTapeState } from "@/lib/turing/singleTapeAdditionMachine";

type StateDiagramProps = {
  currentState?: SingleTapeState;
  lastTransition?: string;
  refreshToken?: string;
};

const nodeSize = 88;

function DiagramViewportSync({ refreshToken }: { refreshToken?: string }) {
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!nodesInitialized) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fitView({
        padding: 0.24,
        duration: 0,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fitView, nodesInitialized, refreshToken]);

  return null;
}

const baseNodes: Node[] = [
  {
    id: "START",
    position: { x: 28, y: 202 },
    data: { label: "" },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      width: 1,
      height: 1,
      opacity: 0,
    },
  },
  {
    id: "SEEK_LEFT",
    position: { x: 170, y: 126 },
    data: { label: "q0" },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: "SEEK_RIGHT",
    position: { x: 500, y: 68 },
    data: { label: "q1" },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: "SEEK_RESULT",
    position: { x: 860, y: 68 },
    data: { label: "q2" },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: "SEEK_RIGHT_MARK",
    position: { x: 1210, y: 126 },
    data: { label: "q3" },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  },
  {
    id: "SEEK_LEFT_MARK",
    position: { x: 1210, y: 374 },
    data: { label: "q4" },
    sourcePosition: Position.Left,
    targetPosition: Position.Top,
  },
  {
    id: "SEEK_FINAL_RESULT",
    position: { x: 500, y: 374 },
    data: { label: "q6" },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: "HALT",
    position: { x: 1600, y: 126 },
    data: { label: "qh", isHalt: true },
    targetPosition: Position.Top,
  },
];

const baseEdges: BuiltInEdge[] = [
  {
    id: "start-q0",
    source: "START",
    target: "SEEK_LEFT",
    label: "load",
    type: "straight",
  },
  {
    id: "q0-q1",
    source: "SEEK_LEFT",
    target: "SEEK_RIGHT",
    label: "mark lhs / implicit 0",
    type: "default",
    pathOptions: {
      curvature: 0.16,
    },
  },
  {
    id: "q1-q2",
    source: "SEEK_RIGHT",
    target: "SEEK_RESULT",
    label: "mark rhs + compute",
    type: "default",
    pathOptions: {
      curvature: 0.16,
    },
  },
  {
    id: "q2-q3",
    source: "SEEK_RESULT",
    target: "SEEK_RIGHT_MARK",
    label: "write result bit",
    type: "default",
    pathOptions: {
      curvature: 0.16,
    },
  },
  {
    id: "q3-q4",
    source: "SEEK_RIGHT_MARK",
    target: "SEEK_LEFT_MARK",
    label: "restore rhs",
    type: "smoothstep",
    pathOptions: {
      offset: 28,
    },
  },
  {
    id: "q5-q0",
    source: "SEEK_LEFT_MARK",
    target: "SEEK_LEFT",
    label: "restore lhs / next column",
    type: "smoothstep",
    pathOptions: {
      offset: 34,
    },
  },
  {
    id: "q0-q6",
    source: "SEEK_LEFT",
    target: "SEEK_FINAL_RESULT",
    label: "final carry",
    type: "smoothstep",
    pathOptions: {
      offset: 22,
    },
  },
  {
    id: "q0-halt",
    source: "SEEK_LEFT",
    target: "HALT",
    label: "done",
    type: "smoothstep",
    pathOptions: {
      offset: 30,
    },
  },
  {
    id: "q6-halt",
    source: "SEEK_FINAL_RESULT",
    target: "HALT",
    label: "write 1",
    type: "smoothstep",
    pathOptions: {
      offset: 42,
    },
  },
];

export default function StateDiagram({
  currentState,
  lastTransition,
  refreshToken,
}: StateDiagramProps) {
  const nodes: Node[] = baseNodes.map((node) => {
    if (node.id === "START") {
      return {
        ...node,
        draggable: false,
        selectable: false,
      };
    }

    return {
      ...node,
      draggable: false,
      selectable: false,
      style: {
        width: nodeSize,
        height: nodeSize,
        borderRadius: "9999px",
        border:
          node.id === "HALT"
            ? "6px double rgba(45, 38, 23, 0.92)"
            : node.id === currentState
              ? "4px solid rgba(168, 125, 50, 0.98)"
              : "3px solid rgba(45, 38, 23, 0.92)",
        background:
          node.id === currentState
            ? "linear-gradient(180deg, #f2dfb0 0%, #e4c883 100%)"
            : "linear-gradient(180deg, #fbf6e8 0%, #ead9b0 100%)",
        color: "#2d2617",
        fontFamily: "var(--font-mono)",
        fontSize: 22,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          node.id === currentState
            ? "0 0 0 1px rgba(255,247,224,0.5) inset, 0 0 24px rgba(168, 125, 50, 0.22)"
            : "0 8px 16px rgba(74, 55, 26, 0.08)",
      },
    };
  });

  const edges: BuiltInEdge[] = baseEdges.map((edge) => {
    const isActive = edge.id === lastTransition;

    return {
      ...edge,
      animated: isActive,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? "#a87d32" : "#463a27",
        width: 18,
        height: 18,
      },
      style: {
        stroke: isActive ? "#a87d32" : "#463a27",
        strokeWidth: isActive ? 3.2 : 2.25,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      },
      labelStyle: {
        fill: "#4e5a44",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 0,
      labelBgStyle: {
        fill: "#f8f1dc",
        fillOpacity: 0.94,
        stroke: "rgba(78, 58, 28, 0.18)",
        strokeWidth: 1,
      },
    };
  });

  return (
    <div className="state-diagram lab-grid h-[360px] w-full overflow-hidden border border-[color:var(--rule)] bg-[linear-gradient(180deg,rgba(250,245,232,0.92),rgba(236,225,197,0.9))] shadow-[inset_0_1px_0_rgba(255,250,239,0.75),0_10px_24px_rgba(70,52,21,0.08)] sm:h-[420px] lg:h-[500px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(78, 58, 28, 0.14)" gap={28} />
        <DiagramViewportSync refreshToken={refreshToken} />
      </ReactFlow>
    </div>
  );
}
