"use client";
import { useMemo } from "react";
import { nodeColor } from "@/lib/nodeColors";
import { truncate } from "@/lib/stringUtils";
import type { GraphNode, MemoryNode } from "@/lib/types";

const CATEGORIES = ["gotcha", "architecture", "pattern", "preference", "workflow", "constraint"] as const;

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-400 tracking-tight text-[10px]">
      {"★".repeat(count)}{"☆".repeat(5 - count)}
    </span>
  );
}

export default function ProjectBoardView({
  memories,
  onSelect,
}: {
  memories: MemoryNode[];
  onSelect: (node: GraphNode) => void;
}) {
  const columns = useMemo(() => {
    const map = new Map<string, MemoryNode[]>();
    for (const m of memories) {
      const col = map.get(m.category) ?? [];
      col.push(m);
      map.set(m.category, col);
    }
    // Sort each column by importance desc
    for (const [, arr] of map) {
      arr.sort((a, b) => b.importance - a.importance);
    }
    return map;
  }, [memories]);

  // Use defined order, but also include any unlisted categories
  const allCategories = [
    ...CATEGORIES.filter(c => columns.has(c)),
    ...[...columns.keys()].filter(c => !(CATEGORIES as readonly string[]).includes(c)),
  ];

  if (allCategories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No memories to display.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-x-auto overflow-y-hidden gap-3 px-4 py-4">
      {allCategories.map(cat => {
        const items = columns.get(cat) ?? [];
        const color = nodeColor(cat);
        return (
          <div
            key={cat}
            className="flex flex-col flex-shrink-0 w-64 rounded-lg bg-[#161b22] border border-[#30363d] overflow-hidden"
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-[#30363d] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">{cat}</span>
              <span className="ml-auto text-[10px] text-gray-600 bg-[#21262d] px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2">
              {items.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m as GraphNode)}
                  className="w-full text-left p-3 rounded-md bg-[#0d1117] border border-[#21262d] hover:border-[#30363d] hover:bg-[#161b22] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Stars count={m.importance} />
                    {m.confidence != null && (
                      <span className="text-[10px] text-gray-600">{Math.round(m.confidence * 100)}%</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed mb-2">
                    {truncate(m.content, 120)}
                  </p>
                  {m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.tags.slice(0, 4).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-gray-400">{t}</span>
                      ))}
                      {m.tags.length > 4 && (
                        <span className="text-[10px] text-gray-600">+{m.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
