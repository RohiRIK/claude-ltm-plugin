"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ClaudeConfig, ClaudeLtmConfig, JanitorRunResult, SettingsModels } from "@/lib/types";
import SettingsForm from "@/components/SettingsForm";
import Link from "next/link";

function formatKeeperResult(r: JanitorRunResult): string {
  return (
    `Done in ${r.durationMs}ms: ${r.embed.embedded} embedded, ` +
    `${r.decay.decayed} decayed (${r.decay.deprecated} deprecated), ` +
    `${r.promote.promoted} promoted, ${r.dedup.candidatesFound} dedup candidates` +
    (r.errors.length > 0 ? ` | Errors: ${r.errors.join("; ")}` : "")
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [models, setModels] = useState<SettingsModels | null>(null);
  const [saving, setSaving] = useState(false);
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const [janitorStatus, setJanitorStatus] = useState<{ running: boolean; lastRun: string | null } | null>(null);
  const [janitorRunning, setJanitorRunning] = useState(false);
  const [janitorResult, setJanitorResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const loadData = useCallback(async () => {
    const [s, m, js, cfg] = await Promise.all([
      api.getSettings(),
      api.getModels(),
      api.janitorStatus(),
      api.getConfig(),
    ]);
    setSettings(s);
    setModels(m);
    setJanitorStatus(js);
    setClaudeConfig(cfg as ClaudeConfig);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => stopPolling, []); // cleanup on unmount

  const handleSave = async (updated: Record<string, string>) => {
    setSaving(true);
    try {
      await api.updateSettings(updated);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleConfigToggle = async (key: keyof ClaudeLtmConfig, value: boolean) => {
    setConfigSaving(true);
    try {
      await api.updateConfig({ [key]: value } as Partial<ClaudeLtmConfig>);
      setClaudeConfig(prev => prev ? { ...prev, ltm: { ...prev.ltm, [key]: value } } : prev);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRunJanitor = async () => {
    setJanitorRunning(true);
    setJanitorResult(null);
    try {
      await api.runJanitor();
    } catch (e) {
      setJanitorResult(`Error: ${String(e)}`);
      setJanitorRunning(false);
      return;
    }

    // Poll /api/janitor/status every 2s until done (max 60s)
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.janitorStatus();
        if (!status.running) {
          stopPolling();
          setJanitorRunning(false);
          setJanitorStatus({ running: false, lastRun: status.lastRun });
          if (status.lastResult) {
            setJanitorResult(formatKeeperResult(status.lastResult));
          }
        }
      } catch { /* ignore transient errors */ }
    }, 2000);

    // 60s hard timeout
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setJanitorRunning(false);
      setJanitorResult("Timed out waiting for Memory Keeper to complete.");
    }, 60_000);
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            &larr; Back to Graph
          </Link>
        </div>

        {models && (
          <SettingsForm
            settings={settings}
            models={models}
            onSave={handleSave}
            saving={saving}
          />
        )}

        {/* Graph Reasoning Controls */}
        {claudeConfig && (
          <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
            <h3 className="text-sm font-medium text-white mb-1">Graph Reasoning</h3>
            <p className="text-xs text-gray-500 mb-4">
              Controls written to <code className="text-gray-400">~/.claude/config.json</code>.
            </p>
            <div className="space-y-3">
              {([
                { key: "graphReasoning", label: "Graph Reasoning", desc: "Inject multi-hop chain, conflict & reinforcement insights into session context during /plan" },
                { key: "autoRelate", label: "Auto-Relate", desc: "Automatically detect and store relations between new and similar memories on learn()" },
                { key: "decayEnabled", label: "Memory Decay", desc: "Score and deprecate stale memories over time based on recency and importance" },
              ] as const).map(({ key, label, desc }) => {
                const checked = Boolean(claudeConfig.ltm?.[key]);
                return (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={configSaving}
                        onChange={e => handleConfigToggle(key, e.target.checked)}
                      />
                      <div className={`w-8 h-4 rounded-full transition-colors ${checked ? "bg-yellow-500" : "bg-gray-700"}`} />
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors">{label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Memory Keeper Controls */}
        <div className="mt-6 p-4 bg-[#161b22] rounded-lg border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Memory Keeper</h3>
              <p className="text-xs text-gray-500 mt-1">
                Run decay, promote, dedup, and embedding generation.
                {janitorStatus?.lastRun && (
                  <span className="ml-1">
                    Last run: {new Date(janitorStatus.lastRun).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleRunJanitor}
              disabled={janitorRunning}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded transition-colors"
            >
              {janitorRunning ? "Running..." : "Run Now"}
            </button>
          </div>
          {janitorResult && (
            <div className="mt-3 text-xs px-3 py-2 rounded bg-[#0d1117] border border-gray-800 text-gray-300 font-mono">
              {janitorResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
