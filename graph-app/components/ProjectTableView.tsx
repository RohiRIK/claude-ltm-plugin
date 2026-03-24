"use client";
import { useState, useMemo } from "react";
import { nodeColor } from "@/lib/nodeColors";
import { truncate } from "@/lib/stringUtils";
import type { GraphNode, MemoryNode } from "@/lib/types";

type SortKey = "category" | "importance" | "confidence" | "content" | "created_at";
type SortDir = "asc" | "desc";

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-400 tracking-tight text-xs">
      {"★".repeat(count)}{"☆".repeat(5 - count)}
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-[#30363d] rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[10px] text-gray-500">{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function ProjectTableView({
  memories,
  onSelect,
}: {
  memories: MemoryNode[];
  onSelect: (node: GraphNode) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("importance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return memories.filter(
      m =>
        !q ||
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [memories, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortKey === "category") { av = a.category; bv = b.category; }
      else if (sortKey === "importance") { av = a.importance; bv = b.importance; }
      else if (sortKey === "confidence") { av = a.confidence; bv = b.confidence; }
      else if (sortKey === "content") { av = a.content; bv = b.content; }
      else { av = a.created_at; bv = b.created_at; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function Th({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <th
        className="px-3 py-2 text-left text-xs font-semibold text-gray-400 cursor-pointer select-none hover:text-white whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        {label}
        {active && <span className="ml-1 text-blue-400">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[#30363d]">
        <input
          type="text"
          placeholder="Filter memories…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[#0d1117] border-b border-[#30363d] z-10">
            <tr>
              <Th label="Category" col="category" />
              <Th label="Importance" col="importance" />
              <Th label="Confidence" col="confidence" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 w-full">Content</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Tags</th>
              <Th label="Created" col="created_at" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">
                  No memories match your filter.
                </td>
              </tr>
            )}
            {sorted.map(m => (
              <tr
                key={m.id}
                onClick={() => onSelect(m as GraphNode)}
                className="border-b border-[#21262d] hover:bg-[#161b22] cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nodeColor(m.category) }} />
                    <span className="text-xs text-gray-300">{m.category}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Stars count={m.importance} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <ConfBar value={m.confidence} />
                </td>
                <td className="px-3 py-2.5 max-w-xs">
                  <span title={m.content} className="text-xs text-gray-300">
                    {truncate(m.content, 80)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {m.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-gray-400">{t}</span>
                    ))}
                    {m.tags.length > 3 && (
                      <span className="text-[10px] text-gray-600">+{m.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[10px] text-gray-500">
                  {m.created_at ? relativeDate(m.created_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-[#30363d] text-xs text-gray-600">
        {sorted.length} of {memories.length} memories
      </div>
    </div>
  );
}
