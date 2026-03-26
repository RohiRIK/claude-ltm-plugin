"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentEntry, ConfigExplorerData, HookEntry, RuleEntry, SkillEntry } from "@/lib/types";

type Tab = "skills" | "agents" | "hooks" | "rules";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-[var(--bg-secondary)]" />
      ))}
    </div>
  );
}

// ─── Simple markdown renderer ──────────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-0.5 mb-2 text-[var(--text-muted)]">
          {listItems.map((item, i) => (
            <li key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function inlineMarkdown(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, '<code class="bg-[var(--bg-tertiary)] px-1 rounded text-sky-400 text-[10px]">$1</code>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={i} className="text-xs font-semibold text-[var(--text-primary)] mt-3 mb-1">{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={i} className="text-sm font-semibold text-[var(--text-primary)] mt-4 mb-1 border-b border-[var(--border)] pb-0.5">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={i} className="text-sm font-bold text-[var(--text-primary)] mt-2 mb-2">{line.slice(2)}</h2>);
    } else if (/^[-*] /.test(line)) {
      listItems.push(line.replace(/^[-*] /, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-xs text-[var(--text-muted)] leading-relaxed mb-1"
          dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
      );
    }
  }
  flushList();

  return <div className="space-y-0">{elements}</div>;
}

// ─── Skills tab ───────────────────────────────────────────────────────────────

function SkillCard({ skill, expanded, onToggle }: { skill: SkillEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 cursor-pointer hover:border-sky-500/40 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--text-primary)] text-sm">{skill.name}</span>
            {skill.slashCommand && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-mono">
                {skill.slashCommand}
              </span>
            )}
            {skill.workflows.length > 0 && (
              <span className="text-[10px] text-[var(--text-muted)]">{skill.workflows.length} workflow{skill.workflows.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug line-clamp-2">{skill.description}</p>
        </div>
        <span className="text-[var(--text-muted)] text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-2">
          {skill.triggerPhrases.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Triggers</div>
              <div className="flex flex-wrap gap-1">
                {skill.triggerPhrases.map((t, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{t}</span>
                ))}
              </div>
            </div>
          )}
          {skill.workflows.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Workflows</div>
              <div className="flex flex-wrap gap-1">
                {skill.workflows.map((w, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">{w}</span>
                ))}
              </div>
            </div>
          )}
          <div className="text-[9px] text-[var(--text-muted)] font-mono opacity-50">{skill.path}</div>
        </div>
      )}
    </div>
  );
}

function SkillsTab({ skills }: { skills: SkillEntry[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = skills.filter(s =>
    !query ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase()) ||
    s.slashCommand?.includes(query.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search skills…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-500/60"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {filtered.map(s => (
          <SkillCard
            key={s.name}
            skill={s}
            expanded={expanded === s.name}
            onToggle={() => setExpanded(prev => prev === s.name ? null : s.name)}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">No skills match &ldquo;{query}&rdquo;</p>
      )}
    </div>
  );
}

// ─── Agents tab ───────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  reviewer: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  planner:  "text-blue-400 bg-blue-500/10 border-blue-500/20",
  architect:"text-purple-400 bg-purple-500/10 border-purple-500/20",
  tdd:      "text-green-400 bg-green-500/10 border-green-500/20",
  builder:  "text-sky-400 bg-sky-500/10 border-sky-500/20",
  doc:      "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  database: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  default:  "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border)]",
};

function agentColor(name: string): string {
  if (name.includes("reviewer") || name.includes("review")) return AGENT_COLORS.reviewer!;
  if (name.includes("planner") || name.includes("plan")) return AGENT_COLORS.planner!;
  if (name.includes("architect")) return AGENT_COLORS.architect!;
  if (name.includes("tdd") || name.includes("test")) return AGENT_COLORS.tdd!;
  if (name.includes("doc")) return AGENT_COLORS.doc!;
  if (name.includes("database") || name.includes("db")) return AGENT_COLORS.database!;
  return AGENT_COLORS.builder!;
}

function AgentCard({ agent }: { agent: AgentEntry }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = agentColor(agent.name);

  return (
    <div
      className={`rounded-lg border bg-[var(--bg-secondary)] p-3 cursor-pointer transition-colors hover:border-opacity-60 ${colorClass.includes("border-") ? colorClass.split(" ").find(c => c.startsWith("border-")) : "border-[var(--border)]"}`}
      style={{ borderColor: undefined }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-3">
        <span className={`text-[10px] px-2 py-1 rounded font-mono font-semibold shrink-0 mt-0.5 border ${colorClass}`}>
          {agent.name}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-primary)] leading-snug line-clamp-2">{agent.description || "—"}</p>
          {!expanded && agent.whenToUse && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug line-clamp-2">
              <span className="text-[10px] uppercase tracking-wide mr-1">When:</span>{agent.whenToUse}
            </p>
          )}
        </div>
        <span className="text-[var(--text-muted)] text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && agent.whenToUse && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">When to use</div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{agent.whenToUse}</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] opacity-40 mt-2">{agent.path}</p>
        </div>
      )}
    </div>
  );
}

function AgentsTab({ agents }: { agents: AgentEntry[] }) {
  return (
    <div className="space-y-2">
      {agents.map(a => <AgentCard key={a.name} agent={a} />)}
    </div>
  );
}

// ─── Hooks tab ────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  PreToolUse:       "text-amber-400 bg-amber-500/10",
  PostToolUse:      "text-emerald-400 bg-emerald-500/10",
  UserPromptSubmit: "text-sky-400 bg-sky-500/10",
  SessionStart:     "text-purple-400 bg-purple-500/10",
  PreCompact:       "text-rose-400 bg-rose-500/10",
};

function HooksTab({ hooks }: { hooks: HookEntry[] }) {
  const grouped = hooks.reduce<Record<string, HookEntry[]>>((acc, h) => {
    (acc[h.event] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([event, list]) => (
        <div key={event}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${EVENT_COLORS[event] ?? "text-[var(--text-muted)] bg-[var(--bg-tertiary)]"}`}>
              {event}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">{list.length} hook{list.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-3 py-2 text-[var(--text-muted)] font-normal w-1/3">Matcher</th>
                  <th className="text-left px-3 py-2 text-[var(--text-muted)] font-normal">Command / Script</th>
                </tr>
              </thead>
              <tbody>
                {list.map((h, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-3 py-2 text-[var(--text-muted)] font-mono text-[11px]">{h.matcher ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-primary)] font-mono text-[11px] max-w-xs" title={h.description}>{h.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {hooks.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">No hooks configured</p>
      )}
    </div>
  );
}

// ─── Rules tab ────────────────────────────────────────────────────────────────

function RulesTab({ rules }: { rules: RuleEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {rules.map(r => (
        <div key={r.name} className="rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            onClick={() => setExpanded(prev => prev === r.name ? null : r.name)}
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)]">{r.name}</span>
              {expanded !== r.name && r.summary && (
                <span className="ml-2 text-xs text-[var(--text-muted)] truncate hidden sm:inline">{r.summary.slice(0, 80)}</span>
              )}
            </div>
            <span className="text-[var(--text-muted)] text-xs ml-2 shrink-0">{expanded === r.name ? "▲" : "▼"}</span>
          </button>
          {expanded === r.name && (
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)] max-h-96 overflow-y-auto">
              <MarkdownContent text={r.content} />
              <p className="text-[9px] font-mono text-[var(--text-muted)] opacity-40 mt-3">{r.path}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [data, setData] = useState<ConfigExplorerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("skills");

  useEffect(() => {
    api.configExplorer()
      .then(setData)
      .catch(e => setError(String(e)));
  }, []);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "skills",  label: "Skills",  count: data?.skills.length },
    { id: "agents",  label: "Agents",  count: data?.agents.length },
    { id: "hooks",   label: "Hooks",   count: data?.hooks.length },
    { id: "rules",   label: "Rules",   count: data?.rules.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-0 border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] mb-3">Claude Config Explorer</h1>
        <div className="flex gap-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-t-md transition-colors border-b-2 ${
                tab === t.id
                  ? "text-[var(--text-primary)] border-sky-500 bg-[var(--bg-secondary)]"
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            Failed to load: {error}
          </div>
        )}
        {!data && !error && <Skeleton />}
        {data && tab === "skills"  && <SkillsTab  skills={data.skills} />}
        {data && tab === "agents"  && <AgentsTab  agents={data.agents} />}
        {data && tab === "hooks"   && <HooksTab   hooks={data.hooks} />}
        {data && tab === "rules"   && <RulesTab   rules={data.rules} />}
      </div>
    </div>
  );
}
