/** Text-only color classes — used in result lists (SemanticSearch, etc.) */
export const categoryTextColors: Record<string, string> = {
  architecture: "text-blue-400",
  gotcha: "text-red-400",
  pattern: "text-purple-400",
  preference: "text-green-400",
  workflow: "text-cyan-400",
  constraint: "text-orange-400",
};

/** Badge classes with background + border — used in pending review cards */
export const categoryBadgeColors: Record<string, string> = {
  architecture: "bg-blue-900/40 text-blue-400 border-blue-800/50",
  gotcha: "bg-red-900/40 text-red-400 border-red-800/50",
  pattern: "bg-purple-900/40 text-purple-400 border-purple-800/50",
  preference: "bg-green-900/40 text-green-400 border-green-800/50",
  workflow: "bg-cyan-900/40 text-cyan-400 border-cyan-800/50",
  constraint: "bg-orange-900/40 text-orange-400 border-orange-800/50",
};
