"use client";
import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  showClusters: boolean;
  onToggle: (val: boolean) => void;
  onRecomputed: () => void;
}

export default function ClusterControls({ showClusters, onToggle, onRecomputed }: Props) {
  const [recomputing, setRecomputing] = useState(false);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await api.recomputeClusters();
      onRecomputed();
    } catch {
      // silently fail
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={showClusters}
          onChange={e => onToggle(e.target.checked)}
          className="accent-blue-500 w-3 h-3"
        />
        Clusters
      </label>
      <button
        onClick={() => void handleRecompute()}
        disabled={recomputing}
        title="Recompute clusters"
        className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] disabled:opacity-50 transition-colors"
      >
        {recomputing ? "…" : "⟳ Recompute"}
      </button>
    </div>
  );
}
