"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ProjectTableView from "@/components/ProjectTableView";
import ProjectBoardView from "@/components/ProjectBoardView";
import { api } from "@/lib/api";
import { nodeColor } from "@/lib/nodeColors";
import type { GraphNode, MemoryNode, ProjectDetail } from "@/lib/types";

const MiniGraph = dynamic(() => import("@/components/MiniGraph"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-600 text-sm">Loading graph…</div>,
});

type ViewMode = "graph" | "table" | "board";
const VIEW_MODES: readonly ViewMode[] = ["graph", "table", "board"];
const LS_KEY = "ltm-project-view";

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "graph";
  const v = localStorage.getItem(LS_KEY);
  if (v === "table" || v === "board") return v;
  return "graph";
}

// View toggle icons — single component with path content swapped per mode
function ViewIcon({ mode, active }: { mode: ViewMode; active: boolean }) {
  const cls = `w-4 h-4 ${active ? "text-blue-400" : "text-gray-500"}`;
  if (mode === "graph") return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="2" strokeWidth={2} />
      <circle cx="19" cy="5" r="2" strokeWidth={2} />
      <circle cx="19" cy="19" r="2" strokeWidth={2} />
      <line x1="7" y1="11" x2="17" y2="6" strokeWidth={2} strokeLinecap="round" />
      <line x1="7" y1="13" x2="17" y2="18" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
  if (mode === "table") return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
      <line x1="3" y1="9" x2="21" y2="9" strokeWidth={2} />
      <line x1="3" y1="15" x2="21" y2="15" strokeWidth={2} />
      <line x1="9" y1="9" x2="9" y2="21" strokeWidth={2} />
    </svg>
  );
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="5" height="18" rx="1.5" strokeWidth={2} />
      <rect x="10" y="3" width="5" height="12" rx="1.5" strokeWidth={2} />
      <rect x="17" y="3" width="5" height="15" rx="1.5" strokeWidth={2} />
    </svg>
  );
}

export default function ProjectPage() {
  const { name } = useParams<{ name: string }>();
  const projectName = decodeURIComponent(name);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  useEffect(() => {
    api.project(projectName)
      .then(setDetail)
      .catch(e => setError(String(e)));
  }, [projectName]);

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(LS_KEY, mode);
  }

  if (error) return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-300 p-6">
      <BackButton />
      <p className="mt-4 text-red-400">Error: {error}</p>
    </div>
  );

  if (!detail) return (
    <div className="flex items-center justify-center h-full bg-[#0d1117] text-gray-600 text-sm">
      Loading…
    </div>
  );

  const totalMemories = detail.memories.length;
  const totalContext = detail.context_items.length;
  const totalRelations = detail.relations.length;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-300 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#30363d] flex items-center gap-4">
        <BackButton />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white truncate">{projectName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalMemories} memories · {totalContext} context items · {totalRelations} relations
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1">
          {VIEW_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => switchView(mode)}
              title={mode.charAt(0).toUpperCase() + mode.slice(1) + " view"}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-[#21262d] ring-1 ring-blue-500/50"
                  : "hover:bg-[#21262d]"
              }`}
            >
              <ViewIcon mode={mode} active={viewMode === mode} />
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {viewMode === "graph" && (
          <>
            {/* Left: MiniGraph */}
            <div className="flex-1 min-w-0 relative overflow-hidden">
              {(detail.memories.length > 0 || detail.context_items.length > 0) ? (
                <MiniGraph
                  projectName={projectName}
                  memories={detail.memories}
                  contextItems={detail.context_items}
                  relations={detail.relations}
                  onNodeClick={n => setSelected(n as GraphNode)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  No nodes connected to this project yet.
                </div>
              )}
            </div>

            {/* Right: node cards + sidebar */}
            <div className="w-72 flex flex-col border-l border-[#30363d] overflow-y-auto">
              {(["goal", "decision", "gotcha", "progress"] as const).map(type => {
                const items = detail.context[type] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={type} className="border-b border-[#30363d]">
                    <div className="px-4 py-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nodeColor(type) }} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{type}</span>
                    </div>
                    {items.map((item, idx) => (
                      <p key={`${item.created_at}-${idx}`} className="px-4 py-1.5 text-xs text-gray-300 border-t border-[#21262d] last:pb-3">
                        {item.content}
                      </p>
                    ))}
                  </div>
                );
              })}

              {detail.memories.length > 0 && (
                <div>
                  <div className="px-4 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Memories</span>
                  </div>
                  {detail.memories.map(m => (
                    <MemoryCard key={m.id} memory={m} onClick={() => setSelected(m as GraphNode)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === "table" && (
          <div className="flex-1 overflow-hidden">
            <ProjectTableView memories={detail.memories} onSelect={setSelected} />
          </div>
        )}

        {viewMode === "board" && (
          <div className="flex-1 overflow-hidden">
            <ProjectBoardView memories={detail.memories} onSelect={setSelected} />
          </div>
        )}

        <Sidebar node={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <Link
      href="/"
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </Link>
  );
}

function MemoryCard({ memory, onClick }: { memory: MemoryNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 border-t border-[#21262d] hover:bg-[#161b22] transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nodeColor(memory.category) }} />
        <span className="text-xs text-gray-500">{memory.category} · imp {memory.importance}</span>
      </div>
      <p className="text-xs text-gray-300 line-clamp-2">{memory.content}</p>
      {memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {memory.tags.map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-gray-400">{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}
