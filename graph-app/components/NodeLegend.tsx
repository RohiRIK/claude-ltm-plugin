"use client";
import { useState } from "react";
import { NODE_COLORS } from "@/lib/nodeColors";

const LEGEND = [
  { label: "Project", cat: "project" },
  { label: "Pattern", cat: "pattern" },
  { label: "Gotcha", cat: "gotcha" },
  { label: "Preference", cat: "preference" },
  { label: "Workflow", cat: "workflow" },
  { label: "Context", cat: "goal" },
  { label: "Decision", cat: "decision" },
];

export default function NodeLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)] select-none">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:text-gray-200 transition-colors"
      >
        <span className="font-medium">Legend</span>
        <span className="ml-auto">{collapsed ? "▲" : "▼"}</span>
      </button>
      {!collapsed && (
        <div className="px-2.5 pb-2 flex flex-col gap-1">
          {LEGEND.map(({ label, cat }) => (
            <div key={cat} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: NODE_COLORS[cat] ?? "#9ca3af" }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
