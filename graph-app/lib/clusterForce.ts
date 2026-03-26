/**
 * clusterForce.ts — D3-compatible centroid force for cluster grouping.
 * Plug in via: fg.d3Force("cluster", buildClusterForce(clusters, show))
 */
import type { Cluster } from "./types";

interface SimNode {
  id: number;
  clusterId?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

type ClusterForce = {
  (alpha: number): void;
  initialize: (nodes: SimNode[]) => void;
};

export function buildClusterForce(clusters: Cluster[], showClusters: boolean): ClusterForce {
  let nodes: SimNode[] = [];
  const clusterIds = new Set(clusters.map(c => c.id));

  const force = (alpha: number): void => {
    if (!showClusters || !clusters.length || !nodes.length) return;

    const centroids = new Map<string, { x: number; y: number; count: number }>();
    for (const n of nodes) {
      if (!n.clusterId || !clusterIds.has(n.clusterId)) continue;
      const c = centroids.get(n.clusterId) ?? { x: 0, y: 0, count: 0 };
      centroids.set(n.clusterId, { x: c.x + (n.x ?? 0), y: c.y + (n.y ?? 0), count: c.count + 1 });
    }

    const strength = 0.12 * alpha;
    for (const n of nodes) {
      if (!n.clusterId) continue;
      const c = centroids.get(n.clusterId);
      if (!c || c.count < 2) continue;
      n.vx = (n.vx ?? 0) + (c.x / c.count - (n.x ?? 0)) * strength;
      n.vy = (n.vy ?? 0) + (c.y / c.count - (n.y ?? 0)) * strength;
    }
  };

  force.initialize = (initNodes: SimNode[]): void => { nodes = initNodes; };

  return force;
}
