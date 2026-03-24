"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { HealthData, ProjectHealthScore, SupersededMemory } from "@/lib/types";

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [projects, setProjects] = useState<ProjectHealthScore[] | null>(null);
  const [superseded, setSuperseded] = useState<SupersededMemory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boosting, setBoosting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, proj, sup] = await Promise.all([
        api.health(),
        api.projectHealth(),
        api.supersededMemories(),
      ]);
      setHealth(data);
      setProjects(proj);
      setSuperseded(sup);
    } catch {
      setError("Failed to load health data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHealth(); }, [loadHealth]);

  const handleBoost = async (id: number) => {
    setBoosting(id);
    try {
      await api.boostMemory(id);
      setHealth((prev) =>
        prev ? { ...prev, atRisk: prev.atRisk.filter((m) => m.id !== id) } : prev
      );
    } finally {
      setBoosting(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await api.deleteMemory(id);
      setSuperseded((prev) => prev ? prev.filter((m) => m.id !== id) : prev);
    } finally {
      setDeleting(null);
    }
  };

  // Overall score: weighted average by memoryCount (single pass)
  const overallScore = (() => {
    if (!projects || projects.length === 0) return null;
    const { weightedSum, totalMemories } = projects.reduce(
      (acc, p) => ({ weightedSum: acc.weightedSum + p.score * p.memoryCount, totalMemories: acc.totalMemories + p.memoryCount }),
      { weightedSum: 0, totalMemories: 0 }
    );
    return Math.round(weightedSum / Math.max(1, totalMemories));
  })();

  const activeCount = health?.stats.find((s) => s.status === "active")?.count ?? 0;
  const supersededCount = health?.stats.find((s) => s.status === "superseded")?.count ?? 0;
  const atRiskCount = health?.atRisk.length ?? 0;

  const actionProjects = projects?.filter((p) => p.status !== "healthy") ?? [];
  const hasActions =
    actionProjects.length > 0 ||
    atRiskCount > 0 ||
    (superseded && superseded.length > 0);

  const projectStatusCounts = {
    healthy: projects?.filter((p) => p.status === "healthy").length ?? 0,
    needsAttention: projects?.filter((p) => p.status === "needs_attention").length ?? 0,
    neglected: projects?.filter((p) => p.status === "neglected").length ?? 0,
  };

  const overallColor = overallScore === null ? "text-gray-400" : scoreTextColor(overallScore);

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-12">{error}</div>
        ) : (
          <>
            {/* ── Section 1: Global Health Banner ── */}
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LTM Health</p>
                  {overallScore !== null && (
                    <div className={`text-5xl font-bold mt-1 font-mono ${overallColor}`}>
                      {overallScore}
                      <span className="text-lg text-gray-600 font-normal ml-1">/100</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Pill label="Active" value={activeCount} color="text-green-400" />
                  <Pill
                    label="Superseded"
                    value={supersededCount}
                    color={supersededCount > 0 ? "text-yellow-400" : "text-gray-600"}
                  />
                  <Pill
                    label="At-Risk"
                    value={atRiskCount}
                    color={atRiskCount > 0 ? "text-orange-400" : "text-gray-600"}
                  />
                  <Pill label="Projects" value={projects?.length ?? 0} color="text-sky-400" />
                </div>
              </div>
              {/* Mini score strip per project */}
              {projects && projects.length > 0 && (
                <div className="flex gap-1.5 mt-5">
                  {projects.map((p) => (
                    <div
                      key={p.project}
                      className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden"
                      title={`${p.project}: ${p.score}`}
                    >
                      <div
                        className={`h-full rounded-full ${scoreBgColor(p.score)}`}
                        style={{ width: `${p.score}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 2: Action Items ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Action Items
              </h2>
              {!hasActions ? (
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-green-900/30 p-4 text-center text-sm text-green-700">
                  ✓ Nothing needs attention — memory health is excellent
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Neglected / needs attention projects */}
                  {actionProjects.map((p) => (
                    <div
                      key={p.project}
                      className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 flex items-center gap-4"
                    >
                      <span className="text-base">{statusIcon(p.status)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{p.project}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusBadgeColor(p.status)}`}>
                            {p.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.memoryCount} memories
                          {p.staleCount > 0 && ` · ${p.staleCount} stale`}
                          {" · "}
                          {p.lastActivityAt
                            ? `last active ${new Date(p.lastActivityAt).toLocaleDateString()}`
                            : "never accessed"}
                        </p>
                      </div>
                      <Link
                        href={`/project/${encodeURIComponent(p.project)}`}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0"
                      >
                        View →
                      </Link>
                    </div>
                  ))}

                  {/* At-risk memories */}
                  {health && health.atRisk.map((m) => (
                    <div
                      key={m.id}
                      className="bg-[var(--bg-secondary)] rounded-lg border border-orange-900/30 p-4 flex items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono bg-red-900/40 text-red-400 border border-red-800/50 rounded px-1.5 py-0.5">
                            {(m.confidence * 100).toFixed(0)}% conf
                          </span>
                          <span className="text-[10px] text-gray-500">{m.category}</span>
                          {m.project_scope && (
                            <span className="text-[10px] text-gray-600">{m.project_scope}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">{m.content}</p>
                      </div>
                      <button
                        onClick={() => void handleBoost(m.id)}
                        disabled={boosting === m.id}
                        className="shrink-0 px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded transition-colors"
                      >
                        {boosting === m.id ? "…" : "Boost"}
                      </button>
                    </div>
                  ))}

                  {/* Superseded memories */}
                  {superseded && superseded.length > 0 && (
                    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Superseded Memories
                        </span>
                        <span className="text-xs text-gray-600">
                          {superseded.length} entries · replaced by newer versions
                        </span>
                      </div>
                      <div className="divide-y divide-gray-800">
                        {superseded.map((m) => (
                          <div key={m.id} className="flex items-start gap-4 p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-gray-500">{m.category}</span>
                                {m.project_scope && (
                                  <span className="text-[10px] text-gray-600">{m.project_scope}</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                                {m.content}
                              </p>
                            </div>
                            <button
                              onClick={() => void handleDelete(m.id)}
                              disabled={deleting === m.id}
                              className={`shrink-0 px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50 ${
                                confirmDelete === m.id
                                  ? "bg-red-600 hover:bg-red-700 text-white"
                                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                              }`}
                            >
                              {deleting === m.id ? "…" : confirmDelete === m.id ? "Sure?" : "Delete"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Section 3: Project Grid ── */}
            {projects && projects.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                    All Projects
                  </h2>
                  <span className="text-xs text-gray-600">
                    {projectStatusCounts.healthy} healthy ·{" "}
                    {projectStatusCounts.needsAttention} needs attention ·{" "}
                    {projectStatusCounts.neglected} neglected
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projects.map((p) => (
                    <ProjectCard key={p.project} project={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────
function scoreTextColor(score: number) {
  return score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
}

function scoreBgColor(score: number) {
  return score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
}

function statusBadgeColor(status: string) {
  if (status === "healthy") return "text-green-400 bg-green-900/20 border-green-800/40";
  if (status === "needs_attention") return "text-yellow-400 bg-yellow-900/20 border-yellow-800/40";
  return "text-red-400 bg-red-900/20 border-red-800/40";
}

function statusIcon(status: string) {
  if (status === "healthy") return "🟢";
  if (status === "needs_attention") return "🟡";
  return "🔴";
}
// ──────────────────────────────────────────────────────────────

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center px-3 py-1.5 bg-gray-800/40 rounded-lg border border-gray-800">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function ProjectCard({ project: p }: { project: ProjectHealthScore }) {
  return (
    <Link href={`/project/${encodeURIComponent(p.project)}`}>
      <div className="bg-[#161b22] rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition-colors cursor-pointer h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">{statusIcon(p.status)}</span>
            <span className="text-sm font-medium text-white truncate">{p.project}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${statusBadgeColor(p.status)}`}>
              {p.status.replace(/_/g, " ")}
            </span>
          </div>
          <span className={`text-xl font-bold font-mono ml-2 shrink-0 ${scoreTextColor(p.score)}`}>{p.score}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{p.memoryCount} memories</span>
          {p.staleCount > 0 && <span className="text-orange-500">{p.staleCount} stale</span>}
          <span>{p.contextItemCount}/4 context</span>
          <span className="ml-auto">
            {p.lastActivityAt ? new Date(p.lastActivityAt).toLocaleDateString() : "never"}
          </span>
        </div>
        {/* Metric bars only for unhealthy projects */}
        {p.status !== "healthy" && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
            <MetricBar label="Freshness" value={p.metrics.memoryFreshness} />
            <MetricBar label="Confidence" value={p.metrics.avgConfidence} />
            <MetricBar label="Context" value={p.metrics.contextCoverage} />
            <MetricBar label="Activity" value={p.metrics.sessionActivity} />
          </div>
        )}
      </div>
    </Link>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const barColor =
    pct >= 70 ? "bg-green-500/60" : pct >= 40 ? "bg-yellow-500/60" : "bg-red-500/60";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right font-mono">{pct}%</span>
    </div>
  );
}
