"use client";
import Link from "next/link";
import type { Stats } from "@/lib/types";

interface Props {
  stats: Stats | null;
}

export default function StatsBar({ stats }: Props) {
  if (!stats) return <div className="h-8 bg-[var(--bg-secondary)] border-b border-[var(--border)]" />;

  const items = [
    { label: "memories", value: stats.memories, color: "text-purple-400" },
    { label: "relations", value: stats.relations, color: "text-blue-400" },
    { label: "projects", value: stats.projects, color: "text-sky-400" },
    { label: "context items", value: stats.context_items, color: "text-orange-400" },
    { label: "tags", value: stats.tags, color: "text-green-400" },
  ];

  return (
    <div className="h-10 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-4 gap-4 text-xs flex-shrink-0">
      <span className="text-[var(--text-muted)] font-medium mr-2">LTM</span>
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="text-gray-700 mr-4">&middot;</span>}
          <span className={`font-bold ${item.color}`}>{item.value}</span>
          <span className="text-gray-500 ml-1">{item.label}</span>
        </span>
      ))}
      <Link
        href="/pending"
        className="ml-auto flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors"
        title="Pending review"
      >
        {stats.pending > 0 ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-400 font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            {stats.pending} pending
          </span>
        ) : (
          <span className="text-xs">Pending</span>
        )}
      </Link>
      <Link
        href="/settings"
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </Link>
    </div>
  );
}
