"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { nodeColor } from "@/lib/nodeColors";
import type { SearchResult } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

export default function SpotlightModal({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Refs so the keydown handler doesn't need to re-register on every keystroke
  const resultsRef = useRef<SearchResult[]>([]);
  const activeIdxRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);

  // Keep refs in sync with latest values/callbacks
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search with stale-result guard
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.search(query);
        if (!cancelled) { setResults(res); setActiveIdx(0); }
      } catch { /* ignore */ }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // Keyboard navigation — registered once when modal opens, uses refs to avoid churn
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key === "ArrowDown") {
        setActiveIdx(i => { const next = Math.min(i + 1, resultsRef.current.length - 1); activeIdxRef.current = next; return next; });
        e.preventDefault();
      }
      if (e.key === "ArrowUp") {
        setActiveIdx(i => { const next = Math.max(i - 1, 0); activeIdxRef.current = next; return next; });
        e.preventDefault();
      }
      if (e.key === "Enter") {
        const r = resultsRef.current[activeIdxRef.current];
        if (r) { onSelectRef.current(r); onCloseRef.current(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]); // deps: only [open] — all other values accessed via refs

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to memory…"
            className="flex-1 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder-[var(--text-muted)]"
          />
          <span className="text-[var(--text-muted)] text-xs">ESC</span>
        </div>

        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li
                key={r.id}
                className={`px-4 py-2.5 cursor-pointer flex gap-3 items-start transition-colors ${
                  i === activeIdx ? "bg-[#1f2937]" : "hover:bg-[#1a2030]"
                }`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => { onSelect(r); onClose(); }}
              >
                <span
                  className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: nodeColor(r.category) }}
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{r.content}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.category}
                    {r.project_scope && ` · ${r.project_scope}`}
                    {` · imp ${r.importance}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && results.length === 0 && (
          <p className="px-4 py-4 text-sm text-gray-500">No results for "{query}"</p>
        )}
      </div>
    </div>
  );
}
