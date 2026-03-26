"use client";
import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type MutableRefObject } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d";
import { forceCollide, forceCenter } from "d3-force";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { buildClusterForce } from "@/lib/clusterForce";
import { hullPoints } from "@/lib/convexHull";
import { nodeColor, nodeRadius } from "@/lib/nodeColors";
import type { Cluster, GraphData, GraphNode } from "@/lib/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GraphHandle {
  zoomToNode: (id: number) => void;
  fitToScreen: () => void;
  resetSimulation: () => void;
}

interface Props {
  data: GraphData;
  activeProject: string | null;
  dimmedIds?: Set<number>;
  highlightedIds?: Set<number>;
  clusters?: Cluster[];
  showClusters?: boolean;
  onNodeClick: (node: GraphNode) => void;
  onClusterClick?: (clusterId: string) => void;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type FGNode = GraphNode & {
  clusterId?: string;
  x?: number; y?: number;
  vx?: number; vy?: number;
  fx?: number | undefined; fy?: number | undefined;
};

type GraphColors = {
  isDark: boolean;
  bg: string;
  linkStroke: string;
  labelFill: string;
  labelFillMuted: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildColors(isDark: boolean): GraphColors {
  return {
    isDark,
    bg: isDark ? "#0d1117" : "#f6f8fa",
    linkStroke: isDark ? "#30363d" : "#d0d7de",
    labelFill: isDark ? "#e6edf3" : "#1f2328",
    labelFillMuted: isDark ? "#6b7280" : "#656d76",
  };
}

function populateTooltip(tip: HTMLDivElement, node: FGNode, isDark: boolean): void {
  while (tip.firstChild) tip.removeChild(tip.firstChild);

  const cat = document.createElement("div");
  cat.style.cssText = `color:${isDark ? "#6b7280" : "#656d76"};font-size:10px;text-transform:uppercase;letter-spacing:0.05em`;
  cat.textContent = node.category;
  tip.appendChild(cat);

  const label = document.createElement("div");
  label.style.cssText = `color:${isDark ? "#e5e7eb" : "#1f2328"};font-weight:600;margin:2px 0`;
  label.textContent = node.label;
  tip.appendChild(label);

  const preview = document.createElement("div");
  preview.style.cssText = `color:${isDark ? "#9ca3af" : "#656d76"};font-size:10px`;
  preview.textContent = node.content.length > 120 ? node.content.substring(0, 119) + "…" : node.content;
  tip.appendChild(preview);

  const stars = document.createElement("div");
  stars.style.cssText = "color:#f59e0b;font-size:10px;margin-top:4px";
  stars.textContent = "★".repeat(node.importance) + "☆".repeat(Math.max(0, 5 - node.importance));
  tip.appendChild(stars);
}

// ─── Error boundary ───────────────────────────────────────────────────────────

class GraphErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-red-400">
          <span>Graph render error</span>
          <button
            className="text-xs text-sky-400 underline"
            onClick={() => this.setState({ error: null })}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Core graph component ─────────────────────────────────────────────────────

const Graph = forwardRef<GraphHandle, Props>(function Graph(
  { data, activeProject, dimmedIds, highlightedIds, clusters, showClusters = true, onNodeClick, onClusterClick },
  ref
) {
  const { resolvedTheme } = useTheme();
  const router = useRouter();

  // Stable refs — updated from props/theme without causing re-renders
  const fgRef = useRef<ForceGraphMethods<FGNode> | undefined>(undefined);
  const colorsRef = useRef<GraphColors>(buildColors(true));
  const dimmedIdsRef = useRef<Set<number> | undefined>(undefined);
  const highlightedIdsRef = useRef<Set<number> | undefined>(undefined);
  const activeProjectRef = useRef<string | null>(null);
  const clustersRef = useRef<Cluster[]>([]);
  const showClustersRef = useRef(true);
  const nodesByIdRef = useRef<Map<number, FGNode>>(new Map());
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const hoveredRef = useRef<FGNode | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onClusterClickRef = useRef(onClusterClick);

  // Keep callback refs fresh without recreating canvas callbacks
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onClusterClickRef.current = onClusterClick; }, [onClusterClick]);
  useEffect(() => { colorsRef.current = buildColors(resolvedTheme !== "light"); }, [resolvedTheme]);
  useEffect(() => { dimmedIdsRef.current = dimmedIds; }, [dimmedIds]);
  useEffect(() => { highlightedIdsRef.current = highlightedIds; }, [highlightedIds]);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { clustersRef.current = clusters ?? []; }, [clusters]);
  useEffect(() => { showClustersRef.current = showClusters; }, [showClusters]);

  // Rebuild nodeById when data changes
  useEffect(() => {
    const map = new Map<number, FGNode>();
    for (const n of data.nodes) map.set(n.id, n as FGNode);
    nodesByIdRef.current = map;
  }, [data]);

  // Attach clusterId to node objects + update cluster force
  useEffect(() => {
    const clusterMap = new Map<number, string>();
    if (showClusters && clusters?.length) {
      for (const cl of clusters) {
        for (const nid of cl.node_ids) clusterMap.set(nid, cl.id);
      }
    }
    for (const n of data.nodes) {
      (n as FGNode).clusterId = clusterMap.get(n.id);
    }
    fgRef.current?.d3Force("cluster", buildClusterForce(clusters ?? [], showClusters));
  }, [clusters, showClusters, data.nodes]);

  // Configure D3 forces after simulation initialises (useEffect runs after paint)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force("charge") as any;
    charge?.strength(-50);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force("link") as any;
    link?.distance(50).strength((l: { type?: string }) => {
      if (l.type === "context_of") return 0.04;
      if (l.type === "project_scope") return 0.25;
      return 0.6;
    });

    fg.d3Force(
      "collision",
      forceCollide<FGNode>().radius(n => nodeRadius(n.importance, "is_project" in n, "is_context" in n) + 4)
    );
    fg.d3Force("cluster", buildClusterForce(clusters ?? [], showClusters));

    // Center force — keeps the graph in the viewport
    const canvas = (fg as unknown as { canvas?: HTMLCanvasElement }).canvas;
    const w = canvas?.width ?? 800;
    const h = canvas?.height ?? 600;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force("center", forceCenter(w / 2, h / 2).strength(0.15) as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Mount/unmount tooltip div
  useEffect(() => {
    const tip = document.createElement("div");
    tip.style.cssText = [
      "position:fixed", "visibility:hidden", "pointer-events:none",
      "z-index:9999", "max-width:280px", "border-radius:8px",
      "padding:8px 10px", "font-size:11px", "line-height:1.5",
    ].join(";");
    document.body.appendChild(tip);
    tooltipRef.current = tip;
    return () => { tip.remove(); tooltipRef.current = null; };
  }, []);

  // ── Imperative handle ──────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomToNode(id: number): void {
      const node = nodesByIdRef.current.get(id);
      if (node?.x != null && node?.y != null) {
        fgRef.current?.centerAt(node.x, node.y, 600);
        fgRef.current?.zoom(1.5, 600);
      }
    },
    fitToScreen(): void {
      fgRef.current?.zoomToFit(400, 40);
    },
    resetSimulation(): void {
      fgRef.current?.d3ReheatSimulation();
    },
  }), []);

  // ── Canvas callbacks (stable — read from refs) ─────────────────────────────

  const paintNode = useCallback((nodeObj: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number): void => {
    const node = nodeObj as FGNode;
    const colors = colorsRef.current;
    const isProject = "is_project" in node;
    const isContext = "is_context" in node;
    const r = nodeRadius(node.importance ?? 1, isProject, isContext);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const color = nodeColor(node.category);
    const dimmed = dimmedIdsRef.current?.has(node.id) ?? false;
    const highlighted = highlightedIdsRef.current?.has(node.id) ?? false;
    const inActiveProject = !!activeProjectRef.current && (node as GraphNode).project_scope === activeProjectRef.current;

    ctx.save();
    ctx.globalAlpha = dimmed ? 0.15 : 1;

    // Glow
    if (isProject || highlighted) {
      ctx.shadowBlur = highlighted ? 10 : 6;
      ctx.shadowColor = highlighted ? "#60a5fa" : color;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = dimmed ? 0.15 : isProject ? 1 : 0.85;
    ctx.fill();

    // Stroke
    if (isProject || highlighted || inActiveProject) {
      ctx.strokeStyle = highlighted ? "#60a5fa" : inActiveProject ? "#ffffff" : color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = dimmed ? 0.15 : 1;

    // Labels
    ctx.textAlign = "center";
    if (isProject) {
      ctx.font = "600 8px sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(node.label.length > 14 ? node.label.substring(0, 13) + "…" : node.label, x, y + r + 9);
    } else if (!isContext) {
      const important = (node.importance ?? 1) >= 4;
      if (important) {
        ctx.font = "7px sans-serif";
        ctx.fillStyle = colors.labelFill;
        ctx.fillText(node.label.length > 18 ? node.label.substring(0, 17) + "…" : node.label, x, y + r + 7);
      } else if (globalScale > 1.2) {
        const labelAlpha = Math.min(1, (globalScale - 0.8) / 0.4);
        ctx.globalAlpha = dimmed ? 0.15 * labelAlpha : labelAlpha;
        ctx.font = "6px sans-serif";
        ctx.fillStyle = colors.labelFillMuted;
        ctx.fillText(node.label.length > 16 ? node.label.substring(0, 15) + "…" : node.label, x, y + r + 7);
      }
    }

    ctx.restore();
  }, []);

  const paintLink = useCallback((linkObj: unknown, ctx: CanvasRenderingContext2D): void => {
    const link = linkObj as { source: FGNode; target: FGNode; type?: string };
    const sx = link.source?.x ?? 0, sy = link.source?.y ?? 0;
    const tx = link.target?.x ?? 0, ty = link.target?.y ?? 0;
    const colors = colorsRef.current;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = colors.linkStroke;
    ctx.lineWidth = link.type === "project_scope" ? 1 : 0.8;
    ctx.globalAlpha = 0.7;
    if (link.type === "context_of") ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.restore();
  }, []);

  // Draw cluster hulls BEFORE nodes (so they appear behind)
  const drawClusterHulls = useCallback((ctx: CanvasRenderingContext2D): void => {
    if (!showClustersRef.current) return;
    const cls = clustersRef.current;
    if (!cls.length) return;
    const nodesById = nodesByIdRef.current;

    for (const cluster of cls) {
      const pts: [number, number][] = [];
      for (const nid of cluster.node_ids) {
        const n = nodesById.get(nid);
        if (n?.x != null && n?.y != null) pts.push([n.x, n.y]);
      }
      if (!pts.length) continue;
      const hull = hullPoints(pts, 18);
      if (!hull || hull.length < 2) continue;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hull[0][0], hull[0][1]);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
      ctx.closePath();
      ctx.fillStyle = cluster.color + "15";
      ctx.strokeStyle = cluster.color + "60";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const handleNodeClick = useCallback((nodeObj: NodeObject): void => {
    const node = nodeObj as FGNode;
    if ("is_project" in node) {
      router.push(`/project/${encodeURIComponent(node.label)}`);
    } else {
      onNodeClickRef.current(node as GraphNode);
    }
  }, [router]);

  const handleNodeHover = useCallback((nodeObj: NodeObject | null): void => {
    hoveredRef.current = nodeObj as FGNode | null;
    const tip = tooltipRef.current;
    if (!tip) return;
    if (nodeObj) {
      const node = nodeObj as FGNode;
      const { isDark } = colorsRef.current;
      populateTooltip(tip, node, isDark);
      tip.style.background = isDark ? "#1c2333" : "#ffffff";
      tip.style.border = `1px solid ${isDark ? "#374151" : "#d0d7de"}`;
      tip.style.boxShadow = isDark ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.15)";
      tip.style.left = `${mouseRef.current.x + 14}px`;
      tip.style.top = `${mouseRef.current.y - 10}px`;
      tip.style.visibility = "visible";
    } else {
      tip.style.visibility = "hidden";
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent): void => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
    if (hoveredRef.current && tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + 14}px`;
      tooltipRef.current.style.top = `${e.clientY - 10}px`;
    }
  }, []);

  return (
    <GraphErrorBoundary>
      <div
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        role="img"
        aria-label="LTM memory graph"
      >
        <ForceGraph2D
          ref={fgRef as MutableRefObject<ForceGraphMethods<FGNode> | undefined>}
          graphData={data as unknown as { nodes: FGNode[]; links: object[] }}
          backgroundColor={colorsRef.current.bg}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onRenderFramePre={drawClusterHulls}
          d3AlphaDecay={0.025}
          cooldownTicks={300}
          autoPauseRedraw={false}
        />
      </div>
    </GraphErrorBoundary>
  );
});

export default Graph;
