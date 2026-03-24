"use client";
import { useMemo, useState } from "react";
import type { GraphNode, Tag } from "@/lib/types";

interface Props {
  nodes: GraphNode[];
  activeProject: string | null;
  hiddenProjects: Set<string>;
  onSelect: (name: string | null) => void;
  onToggleHide: (name: string) => void;
  tags: Tag[];
  activeTags: Set<string>;
  onToggleTag: (name: string) => void;
  onClearAllTags: () => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function ProjectList({
  nodes, activeProject, hiddenProjects, onSelect, onToggleHide,
  tags, activeTags, onToggleTag, onClearAllTags,
}: Props) {
  const allProjects = nodes.filter(n => "is_project" in n);
  const [projectsOpen, setProjectsOpen] = useState(true);

  const projectMemoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      if (!("is_project" in n) && !("is_context" in n) && "project_scope" in n && n.project_scope) {
        counts[n.project_scope] = (counts[n.project_scope] ?? 0) + 1;
      }
    }
    return counts;
  }, [nodes]);
  const [tagsOpen, setTagsOpen] = useState(true);

  return (
    <div className="w-48 min-w-[176px] bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col overflow-hidden">

      {/* ── Projects ── */}
      <button
        onClick={() => setProjectsOpen(o => !o)}
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">Projects</span>
        <span className="text-[var(--text-muted)]"><ChevronIcon open={projectsOpen} /></span>
      </button>
      {projectsOpen && (
        <div className="flex flex-col border-b border-[var(--border)]">
          <button
            onClick={() => onSelect(null)}
            className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors ${!activeProject ? "text-[var(--text-primary)] font-medium bg-[var(--bg-tertiary)]" : "text-[var(--text-muted)]"}`}
          >
            All projects
          </button>
          {allProjects.map(p => {
            const hidden = hiddenProjects.has(p.label);
            const count = projectMemoryCounts[p.label] ?? 0;
            return (
              <div
                key={p.id}
                className={`group flex items-center gap-1 pr-1 hover:bg-[var(--bg-tertiary)] transition-colors ${hidden ? "opacity-40" : count === 0 ? "opacity-50" : ""}`}
              >
                <button
                  onClick={() => !hidden && onSelect(activeProject === p.label ? null : p.label)}
                  className={`flex-1 text-left text-xs px-3 py-1.5 truncate ${activeProject === p.label && !hidden ? "text-sky-400 font-medium" : "text-[var(--text-muted)]"}`}
                  title={p.label}
                >
                  {p.label.split("/").pop() || p.label}
                </button>
                {count > 0 && (
                  <span className="text-[9px] text-gray-600 font-mono shrink-0">{count}</span>
                )}
                <button
                  onClick={() => onToggleHide(p.label)}
                  className="shrink-0 p-1 rounded opacity-30 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-300"
                  title={hidden ? "Show project" : "Hide project"}
                >
                  {hidden ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7c1.03 0 2.02.15 2.95.43M6.1 6.1l11.8 11.8M9.9 9.9A3 3 0 0114.1 14.1" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tags ── */}
      <div className="flex items-center border-b border-[var(--border)]">
        <button
          onClick={() => setTagsOpen(o => !o)}
          className="flex-1 flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">
            Tags
            {activeTags.size > 0 && (
              <span className="text-[9px] text-sky-400 bg-sky-900/30 border border-sky-800/40 rounded px-1 py-0.5 normal-case tracking-normal font-normal">
                {activeTags.size} active
              </span>
            )}
          </span>
          <span className="text-[var(--text-muted)]"><ChevronIcon open={tagsOpen} /></span>
        </button>
        {activeTags.size > 0 && (
          <button
            onClick={onClearAllTags}
            className="px-2 text-[10px] text-gray-500 hover:text-gray-300 underline shrink-0"
          >
            clear
          </button>
        )}
      </div>
      {tagsOpen && (
        <div className="flex-1 overflow-y-auto">
          {tags.map(tag => {
            const active = activeTags.has(tag.name);
            return (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.name)}
                className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors ${active ? "text-sky-400" : "text-[var(--text-muted)]"}`}
              >
                <span className="truncate">{tag.name}</span>
                <span className={`ml-2 shrink-0 text-[10px] tabular-nums ${active ? "text-sky-500" : "text-gray-600"}`}>
                  {tag.memory_count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
