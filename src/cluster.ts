/**
 * cluster.ts — Label Propagation community detection for LTM graph nodes.
 */
import type { Cluster, GraphNode, GraphLink } from './graph-app/lib/types.js';

export type { Cluster };

/** Label Propagation Algorithm — up to 20 iterations */
export function detectCommunities(nodes: GraphNode[], edges: GraphLink[]): Map<number, string> {
  const labels = new Map<number, number>();
  nodes.forEach(n => labels.set(n.id, n.id));

  const adj = new Map<number, number[]>();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    const src = typeof e.source === 'object' ? (e.source as GraphNode).id : (e.source as number);
    const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : (e.target as number);
    adj.get(src)?.push(tgt);
    adj.get(tgt)?.push(src);
  });

  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    // Fisher-Yates shuffle — single allocation per iteration
    const nodeOrder = [...nodes];
    for (let i = nodeOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nodeOrder[i], nodeOrder[j]] = [nodeOrder[j]!, nodeOrder[i]!];
    }
    for (const node of nodeOrder) {
      const neighbors = adj.get(node.id) ?? [];
      if (neighbors.length === 0) continue;
      const freq = new Map<number, number>();
      for (const nb of neighbors) {
        const lbl = labels.get(nb) ?? nb;
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }
      let maxCount = 0;
      let bestLabel = labels.get(node.id) ?? node.id;
      for (const [lbl, cnt] of freq) {
        if (cnt > maxCount) { maxCount = cnt; bestLabel = lbl; }
      }
      if (bestLabel !== labels.get(node.id)) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const labelToCluster = new Map<number, string>();
  let clusterIdx = 0;
  const result = new Map<number, string>();
  for (const [nodeId, lbl] of labels) {
    if (!labelToCluster.has(lbl)) {
      labelToCluster.set(lbl, `cluster-${clusterIdx++}`);
    }
    result.set(nodeId, labelToCluster.get(lbl)!);
  }
  return result;
}

/** Pick top-3 tags across nodes in the cluster as a label */
export function generateClusterLabel(tags: string[][], fallback: string): string {
  const freq = new Map<string, number>();
  for (const tagList of tags) {
    // Deduplicate per-node tags to avoid inflating frequency for duplicate entries
    for (const tag of new Set(tagList)) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([t]) => t);
  return top.length > 0 ? top.join(' · ') : fallback;
}

/** Assign evenly-distributed HSL colors for N clusters */
export function assignClusterColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hue = Math.round((i / count) * 360);
    return `hsl(${hue}, 65%, 55%)`;
  });
}
