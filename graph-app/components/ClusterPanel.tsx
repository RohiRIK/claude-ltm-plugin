"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Cluster } from "@/lib/types";

interface Props {
  cluster: Cluster | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ClusterPanel({ cluster, onClose, onUpdated }: Props) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!cluster) return null;

  const handleRename = async () => {
    if (!labelInput.trim()) return;
    setLoading(true);
    try {
      await api.renameCluster(cluster.id, labelInput.trim());
      onUpdated();
      setEditingLabel(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: cluster.color }}
          />
          {editingLabel ? (
            <input
              autoFocus
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleRename(); if (e.key === "Escape") setEditingLabel(false); }}
              className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-0.5 text-sm text-[var(--text-primary)] outline-none"
            />
          ) : (
            <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{cluster.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editingLabel ? (
            <>
              <button
                onClick={() => void handleRename()}
                disabled={loading}
                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingLabel(false)}
                className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => { setLabelInput(cluster.label); setEditingLabel(true); }}
              title="Rename cluster"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1"
            >
              ✎
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-1"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Cluster ID</p>
          <p className="text-xs font-mono text-[var(--text-secondary)]">{cluster.id}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Members</p>
          <p className="text-sm text-[var(--text-primary)] font-semibold">{cluster.node_ids.length} nodes</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Last Updated</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {new Date(cluster.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </aside>
  );
}
