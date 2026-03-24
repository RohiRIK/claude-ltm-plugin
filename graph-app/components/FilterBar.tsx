"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { categoryBadgeColors } from "@/lib/categoryColors";
import ImportanceStars from "@/components/ImportanceStars";
import type { SearchResult, SemanticResult } from "@/lib/types";

interface Props {
  onSearch: (results: SearchResult[] | null) => void;
  onImportanceMin: (min: number) => void;
  importanceMin: number;
  onSpotlightOpen: () => void;
  onSemanticSelect: (id: number) => void;
}

export default function FilterBar({ onSearch, onImportanceMin, importanceMin, onSpotlightOpen, onSemanticSelect }: Props) {
  const [query, setQuery] = useState("");
  const [semanticMode, setSemanticMode] = useState(false);
  const [semResults, setSemResults] = useState<SemanticResult[] | null>(null);
  const [semLoading, setSemLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Keyword search — only runs when NOT in semantic mode
  useEffect(() => {
    if (semanticMode) return;
    if (query.length < 2) { onSearch(null); return; }
    const t = setTimeout(async () => {
      try { onSearch(await api.search(query)); }
      catch { onSearch(null); }
    }, 200);
    return () => clearTimeout(t);
  }, [query, onSearch, semanticMode]);

  // Side effects when semantic mode changes
  useEffect(() => {
    if (semanticMode) {
      onSearch(null);
      setQuery("");
    } else {
      setSemResults(null);
    }
  }, [semanticMode, onSearch]);

  const toggleSemanticMode = () => setSemanticMode(v => !v);

  const runSemanticSearch = async () => {
    if (!query.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSemLoading(true);
    try {
      setSemResults(await api.semanticSearch(query.trim(), 10));
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setSemResults([]);
    } finally {
      setSemLoading(false);
    }
  };

  return (
    <div className="relative border-b border-[var(--border)]">
      <div className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-secondary)] text-xs flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => semanticMode && e.key === "Enter" && void runSemanticSearch()}
          placeholder={semanticMode ? "Semantic search… (Enter)" : "Search memories…"}
          className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border)] rounded px-2 py-1 text-xs w-48 outline-none focus:border-[var(--text-muted)]"
        />
        <label className="text-[var(--text-muted)] flex items-center gap-1.5">
          Min importance:
          <span className="text-[var(--text-muted)] text-xs">1</span>
          <input
            type="range"
            min={1}
            max={5}
            value={importanceMin}
            onChange={e => onImportanceMin(Number(e.target.value))}
            className="w-20 accent-purple-400"
          />
          <span className="text-[var(--text-muted)] text-xs">5</span>
          <span className="text-[var(--text-primary)] w-3">{importanceMin}</span>
        </label>
        <button
          onClick={onSpotlightOpen}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors text-xs"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <span>⌘K</span>
        </button>
        <button
          onClick={toggleSemanticMode}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            semanticMode
              ? "bg-sky-600 border-sky-500 text-white"
              : "bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]"
          }`}
        >
          {semLoading ? "…" : "Semantic"}
        </button>
      </div>

      {/* Semantic results — inline dropdown */}
      {semanticMode && semResults !== null && (
        <div className="bg-[var(--bg-primary)] px-4 py-2">
          {semResults.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-1">No results above similarity threshold.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {semResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { onSemanticSelect(r.id); setSemResults(null); }}
                  className="w-full text-left px-3 py-2.5 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-mono bg-sky-900/40 text-sky-400 border border-sky-800/50 rounded px-1.5 py-0.5 shrink-0">
                      {Math.round(r.similarity * 100)}%
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize shrink-0 ${categoryBadgeColors[r.category] ?? "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]"}`}>
                      {r.category}
                    </span>
                    {r.project_scope && (
                      <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5 truncate max-w-[120px]">
                        {r.project_scope.split("/").pop()}
                      </span>
                    )}
                    <span className="ml-auto shrink-0">
                      <ImportanceStars n={r.importance} />
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed line-clamp-2">{r.content}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
