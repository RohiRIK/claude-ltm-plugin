"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { categoryBadgeColors } from "@/lib/categoryColors";
import type { PendingMemory } from "@/lib/types";
import Link from "next/link";

export default function PendingPage() {
  const [pending, setPending] = useState<PendingMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.pending();
      setPending(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleApprove = async (id: number) => {
    setActionInProgress(id);
    try {
      await api.approveMemory(id);
      setPending((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionInProgress(id);
    try {
      await api.deleteMemory(id);
      setPending((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleApproveAll = async () => {
    setActionInProgress(-1);
    try {
      await Promise.all(pending.map((m) => api.approveMemory(m.id)));
      setPending([]);
    } finally {
      setActionInProgress(null);
    }
  };

  const dedupCandidates = pending.filter((m) => m.source?.startsWith("dedup:"));

  const handleMergeAll = async () => {
    if (!confirm(`Merge ${dedupCandidates.length} duplicate pair${dedupCandidates.length === 1 ? "" : "s"}?`)) return;
    setActionInProgress(-2);
    try {
      await api.mergeAll(0.95);
      await loadPending();
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Pending Review</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {pending.length} {pending.length === 1 ? "memory" : "memories"} awaiting approval
            </p>
          </div>
          <div className="flex gap-3">
            {dedupCandidates.length > 0 && (
              <button
                onClick={handleMergeAll}
                disabled={actionInProgress !== null}
                className="px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded transition-colors"
              >
                Merge All Duplicates (&ge;95%)
              </button>
            )}
            {pending.length > 1 && (
              <button
                onClick={handleApproveAll}
                disabled={actionInProgress !== null}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors"
              >
                Approve All
              </button>
            )}
            <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5">
              &larr; Graph
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 text-lg mb-2">No pending memories</div>
            <p className="text-gray-500 text-sm">
              Run the janitor to auto-promote decisions and gotchas from context items.
            </p>
            <Link href="/settings" className="text-blue-400 hover:text-blue-300 text-sm mt-3 inline-block">
              Go to Settings &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((mem) => (
              <div
                key={mem.id}
                className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded border ${categoryBadgeColors[mem.category] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}
                      >
                        {mem.category}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {"*".repeat(mem.importance)}{"*".repeat(5 - mem.importance).replace(/\*/g, ".")}
                      </span>
                      {mem.project_scope && (
                        <span className="text-[10px] text-gray-500">
                          {mem.project_scope}
                        </span>
                      )}
                      {mem.source && (
                        <span className="text-[10px] text-gray-600 italic">
                          via {mem.source}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm text-gray-300 leading-relaxed ${expandedIds.has(mem.id) ? "" : "line-clamp-3"}`}>
                      {mem.content}
                    </p>
                    {mem.content.length > 120 && (
                      <button
                        onClick={() => toggleExpand(mem.id)}
                        className="text-[10px] text-gray-500 hover:text-gray-300 mt-1 transition-colors"
                      >
                        {expandedIds.has(mem.id) ? "Show less ↑" : "Show more ↓"}
                      </button>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      {new Date(mem.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(mem.id)}
                      disabled={actionInProgress !== null}
                      className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors"
                      title="Approve — promote to active memory"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(mem.id)}
                      disabled={actionInProgress !== null}
                      className="px-3 py-1.5 text-xs bg-red-900/60 hover:bg-red-900/80 text-red-400 disabled:opacity-50 rounded transition-colors"
                      title="Reject — delete and reset context item"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
