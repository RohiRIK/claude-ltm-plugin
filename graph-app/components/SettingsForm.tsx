"use client";
import { useEffect, useRef, useState } from "react";
import type { SettingsModels } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  settings: Record<string, string>;
  models: SettingsModels;
  onSave: (settings: Record<string, string>) => Promise<void>;
  saving: boolean;
}

type KeyState = "idle" | "verifying" | "valid" | "invalid";
type ProviderColor = "blue" | "green" | "orange" | "purple" | "pink" | "gray";

// ── Module-level maps (avoid recreating on every render) ──────────────────────

const accentMap: Record<ProviderColor, string> = {
  blue: "ring-blue-500/30 border-blue-500/20",
  green: "ring-green-500/30 border-green-500/20",
  orange: "ring-orange-500/30 border-orange-500/20",
  purple: "ring-purple-500/30 border-purple-500/20",
  pink: "ring-pink-500/30 border-pink-500/20",
  gray: "ring-gray-500/20 border-gray-500/20",
};

const badgeMap: Record<ProviderColor, string> = {
  blue: "bg-blue-900/40 text-blue-300",
  green: "bg-green-900/40 text-green-300",
  orange: "bg-orange-900/40 text-orange-300",
  purple: "bg-purple-900/40 text-purple-300",
  pink: "bg-pink-900/40 text-pink-300",
  gray: "bg-gray-800 text-gray-400",
};

// ── Provider metadata ─────────────────────────────────────────────────────────

interface ProviderMeta {
  id: string;
  label: string;
  color: ProviderColor;
  supportsEmbed: boolean;
  supportsLLM: boolean;
  apiKeyLabel: string;
  apiKeyKey: string | null;   // null = no API key (Ollama uses base URL)
  baseUrlKey?: string;
  embedModelKey?: string;
  llmModelKey?: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    color: "blue",
    supportsEmbed: true,
    supportsLLM: true,
    apiKeyLabel: "Gemini API Key",
    apiKeyKey: "ltm.gemini.apiKey",
    embedModelKey: "ltm.gemini.embedModel",
    llmModelKey: "ltm.gemini.llmModel",
  },
  {
    id: "openai",
    label: "OpenAI",
    color: "green",
    supportsEmbed: true,
    supportsLLM: true,
    apiKeyLabel: "OpenAI API Key",
    apiKeyKey: "ltm.openai.apiKey",
    embedModelKey: "ltm.openai.embedModel",
    llmModelKey: "ltm.openai.llmModel",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    color: "orange",
    supportsEmbed: false,
    supportsLLM: true,
    apiKeyLabel: "Anthropic API Key",
    apiKeyKey: "ltm.anthropic.apiKey",
    llmModelKey: "ltm.anthropic.llmModel",
  },
  {
    id: "cohere",
    label: "Cohere",
    color: "purple",
    supportsEmbed: true,
    supportsLLM: true,
    apiKeyLabel: "Cohere API Key",
    apiKeyKey: "ltm.cohere.apiKey",
    embedModelKey: "ltm.cohere.embedModel",
    llmModelKey: "ltm.cohere.llmModel",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    color: "pink",
    supportsEmbed: true,
    supportsLLM: true,
    apiKeyLabel: "OpenRouter API Key",
    apiKeyKey: "ltm.openrouter.apiKey",
    embedModelKey: "ltm.openrouter.embedModel",
    llmModelKey: "ltm.openrouter.llmModel",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    color: "gray",
    supportsEmbed: true,
    supportsLLM: true,
    apiKeyLabel: "Base URL",
    apiKeyKey: null,
    baseUrlKey: "ltm.ollama.baseUrl",
    embedModelKey: "ltm.ollama.embedModel",
    llmModelKey: "ltm.ollama.llmModel",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-gray-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

// ── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({
  meta,
  draft,
  models,
  keyState,
  roleLabels,
  onChange,
  onVerify,
}: {
  meta: ProviderMeta;
  draft: Record<string, string>;
  models: SettingsModels;
  keyState: KeyState;
  roleLabels: string[];   // ["Embed", "LLM"] etc.
  onChange: (key: string, value: string) => void;
  onVerify: () => void;
}) {
  const accent = accentMap[meta.color];
  const badge = badgeMap[meta.color];
  const isOllama = meta.id === "ollama";
  const verified = keyState === "valid" || isOllama;

  // Key field value (API key or base URL for Ollama)
  const keyFieldKey = isOllama ? meta.baseUrlKey! : meta.apiKeyKey!;
  const keyValue = draft[keyFieldKey] ?? "";

  const embedModels = models.embedModels?.[meta.id] ?? [];
  const llmModels = models.llmModels?.[meta.id] ?? [];

  const showEmbed = roleLabels.includes("Embed");
  const showLlm = roleLabels.includes("LLM");

  return (
    <div className={`p-5 bg-[#161b22] rounded-xl border ring-1 ${accent} space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{meta.label}</span>
          {roleLabels.map((r) => (
            <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge}`}>
              {r}
            </span>
          ))}
        </div>
        {/* Verify status badge */}
        {!isOllama && (
          <div className="flex items-center gap-1.5 text-xs">
            {keyState === "verifying" && <><Spinner /><span className="text-gray-400">Verifying…</span></>}
            {keyState === "valid" && <><CheckIcon /><span className="text-emerald-400">Connected</span></>}
            {keyState === "invalid" && <><XIcon /><span className="text-red-400">Invalid key</span></>}
          </div>
        )}
      </div>

      {/* API Key / Base URL field */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">{meta.apiKeyLabel}</label>
        <div className="relative">
          <input
            type={isOllama ? "text" : "password"}
            value={keyValue}
            onChange={(e) => onChange(keyFieldKey, e.target.value)}
            onBlur={() => { if (!isOllama && keyValue.length > 0 && keyState === "idle") onVerify(); }}
            onPaste={() => { if (!isOllama) setTimeout(onVerify, 50); }}
            placeholder={isOllama ? "http://localhost:11434" : "Paste key to verify…"}
            className={`w-full bg-[#0d1117] border rounded-lg px-3 py-2 pr-9 text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono transition-colors ${
              keyState === "invalid"
                ? "border-red-500/60 focus:border-red-500"
                : keyState === "valid"
                ? "border-emerald-500/60 focus:border-emerald-500"
                : "border-white/10 focus:border-white/30"
            }`}
          />
          {/* Icon inside input */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {keyState === "verifying" && <Spinner />}
            {keyState === "valid" && <CheckIcon />}
            {keyState === "invalid" && <XIcon />}
          </div>
        </div>
        {keyState === "idle" && !isOllama && keyValue.length > 0 && (
          <button
            type="button"
            onClick={onVerify}
            className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Verify connection →
          </button>
        )}
      </div>

      {/* Embed model */}
      {showEmbed && meta.embedModelKey && (
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Embedding Model</label>
          <select
            value={draft[meta.embedModelKey] ?? ""}
            onChange={(e) => onChange(meta.embedModelKey!, e.target.value)}
            disabled={!verified || embedModels.length === 0}
            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {embedModels.length === 0
              ? <option value="">Verify API key to load models</option>
              : embedModels.map((m) => <option key={m} value={m}>{m}</option>)
            }
          </select>
        </div>
      )}

      {/* LLM model */}
      {showLlm && meta.llmModelKey && (
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">LLM Model</label>
          <select
            value={draft[meta.llmModelKey] ?? ""}
            onChange={(e) => onChange(meta.llmModelKey!, e.target.value)}
            disabled={!verified || llmModels.length === 0}
            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {llmModels.length === 0
              ? <option value="">Verify API key to load models</option>
              : llmModels.map((m) => <option key={m} value={m}>{m}</option>)
            }
          </select>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsForm({ settings, models, onSave, saving }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...settings });
  const [dirty, setDirty] = useState(false);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  // Dynamic models fetched from provider API on successful verify
  const [liveModels, setLiveModels] = useState<Record<string, { embedModels: string[]; llmModels: string[] }>>({});
  const draftRef = useRef<Record<string, string>>(draft);
  const initialized = useRef(false);

  // Seed draft once on first real settings load, then auto-verify stored keys
  useEffect(() => {
    if (!initialized.current && Object.keys(settings).length > 0) {
      initialized.current = true;
      setDraft(settings);
      draftRef.current = settings;
      // Auto-verify any provider that already has a stored key
      for (const meta of PROVIDERS) {
        if (!meta.apiKeyKey) continue;
        const storedKey = settings[meta.apiKeyKey] ?? "";
        if (storedKey.length >= 4) {
          verifyProvider(meta.id);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
  };

  const handleKeyChange = (providerId: string, key: string, value: string) => {
    handleChange(key, value);
    // Reset verification when key is edited
    setKeyStates((prev) => ({ ...prev, [providerId]: "idle" }));
  };

  const verifyProvider = async (providerId: string) => {
    const meta = PROVIDERS.find((p) => p.id === providerId);
    if (!meta || !meta.apiKeyKey) return;

    // Read from ref to avoid stale closure (e.g. when called from onPaste timeout)
    const key = draftRef.current[meta.apiKeyKey] ?? "";
    if (key.length < 4) {
      setKeyStates((prev) => ({ ...prev, [providerId]: "invalid" }));
      return;
    }

    setKeyStates((prev) => ({ ...prev, [providerId]: "verifying" }));

    try {
      // Send key inline — server persists it via setSetting() before verifying
      const res = await fetch("/api/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, key }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        error?: string;
        embedModels?: string[];
        llmModels?: string[];
      };
      setKeyStates((prev) => ({
        ...prev,
        [providerId]: result.ok ? "valid" : "invalid",
      }));
      if (result.ok && (result.embedModels?.length || result.llmModels?.length)) {
        setLiveModels((prev) => ({
          ...prev,
          [providerId]: {
            embedModels: result.embedModels ?? [],
            llmModels: result.llmModels ?? [],
          },
        }));
      }
    } catch {
      setKeyStates((prev) => ({ ...prev, [providerId]: "invalid" }));
    }
  };

  const handleSave = async () => {
    await onSave(draft);
    setDirty(false);
  };

  // Derive which provider cards to show
  const embedProvider = draft["ltm.embed.provider"] ?? "";
  const llmProvider = draft["ltm.llm.provider"] ?? "";
  const activeProviderIds = new Set([embedProvider, llmProvider]);

  const activeProviders = PROVIDERS.filter((p) => activeProviderIds.has(p.id));

  const getRoleLabels = (meta: ProviderMeta) => {
    const labels: string[] = [];
    if (meta.id === embedProvider) labels.push("Embed");
    if (meta.id === llmProvider) labels.push("LLM");
    return labels;
  };

  const inputCls =
    "w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-white/30 focus:outline-none transition-colors";
  const selectCls =
    "w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-white/30 focus:outline-none transition-colors";

  return (
    <div className="space-y-6">
      {/* ── Provider Selection ───────────────────────────────────────────────── */}
      <div className="p-5 bg-[#161b22] rounded-xl border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white">Provider Selection</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Embedding Provider</label>
            <select
              value={draft["ltm.embed.provider"] ?? ""}
              onChange={(e) => handleChange("ltm.embed.provider", e.target.value)}
              className={selectCls}
            >
              {models.embeddingProviders.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">LLM Provider</label>
            <select
              value={draft["ltm.llm.provider"] ?? ""}
              onChange={(e) => handleChange("ltm.llm.provider", e.target.value)}
              className={selectCls}
            >
              {models.llmProviders.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Active Provider Cards ────────────────────────────────────────────── */}
      {activeProviders.map((meta) => {
        // Merge live (verified) models over static fallback
        const live = liveModels[meta.id];
        const mergedModels: SettingsModels = {
          ...models,
          embedModels: {
            ...models.embedModels,
            ...(live?.embedModels.length ? { [meta.id]: live.embedModels } : {}),
          },
          llmModels: {
            ...models.llmModels,
            ...(live?.llmModels.length ? { [meta.id]: live.llmModels } : {}),
          },
        };
        return (
          <ProviderCard
            key={meta.id}
            meta={meta}
            draft={draft}
            models={mergedModels}
            keyState={keyStates[meta.id] ?? "idle"}
            roleLabels={getRoleLabels(meta)}
            onChange={(key, value) => handleKeyChange(meta.id, key, value)}
            onVerify={() => verifyProvider(meta.id)}
          />
        );
      })}

      {/* ── Memory Decay ────────────────────────────────────────────────────── */}
      <div className="p-5 bg-[#161b22] rounded-xl border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white">Memory Decay</h3>
        {[
          { key: "ltm.decay.graceDays", label: "Grace Period (days)", placeholder: "30" },
          { key: "ltm.decay.rate", label: "Decay Rate per Day", placeholder: "0.02" },
          { key: "ltm.decay.minConfidence", label: "Min Confidence (deprecation threshold)", placeholder: "0.2" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
            <input
              type="text"
              value={draft[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* ── Memory Keeper ───────────────────────────────────────────────────── */}
      <div className="p-5 bg-[#161b22] rounded-xl border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white">Auto-Promote & Memory Keeper</h3>
        {[
          { key: "ltm.promote.minImportance", label: "Promote Min Importance", placeholder: "3" },
          { key: "ltm.janitor.intervalMinutes", label: "Auto-run Interval (minutes, 0 = disabled)", placeholder: "0" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
            <input
              type="text"
              value={draft[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* ── Save ────────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="w-full py-3 text-sm font-semibold rounded-xl transition-all bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-emerald-800"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Saving…
          </span>
        ) : (
          "Save Configuration"
        )}
      </button>
    </div>
  );
}
