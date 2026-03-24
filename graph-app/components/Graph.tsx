"use client";
import * as d3 from "d3";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { nodeColor, nodeRadius } from "@/lib/nodeColors";
import { hullPath } from "@/lib/convexHull";
import type { Cluster, GraphData, GraphNode } from "@/lib/types";

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

// Flat node shape for D3 — avoids union extension issues
interface RawNode {
  id: number;
  label: string;
  content: string;
  category: string;
  importance: number;
  project_scope: string | null;
  is_project?: boolean;
  is_context?: boolean;
  clusterId?: string;
  // D3 simulation fields
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  // Original GraphNode reference
  _original: GraphNode;
}

interface RawLink {
  source: RawNode;
  target: RawNode;
  type: string;
}

/** Build tooltip content using safe DOM methods — no innerHTML */
function populateTooltip(tip: HTMLDivElement, d: RawNode, isDark: boolean) {
  while (tip.firstChild) tip.removeChild(tip.firstChild);

  const cat = document.createElement("div");
  cat.style.cssText = `color:${isDark ? "#6b7280" : "#656d76"};font-size:10px;text-transform:uppercase;letter-spacing:0.05em`;
  cat.textContent = d.category;
  tip.appendChild(cat);

  const label = document.createElement("div");
  label.style.cssText = `color:${isDark ? "#e5e7eb" : "#1f2328"};font-weight:600;margin:2px 0`;
  label.textContent = d.label;
  tip.appendChild(label);

  const preview = document.createElement("div");
  preview.style.cssText = `color:${isDark ? "#9ca3af" : "#656d76"};font-size:10px`;
  preview.textContent = d.content.length > 120 ? d.content.substring(0, 119) + "…" : d.content;
  tip.appendChild(preview);

  const stars = document.createElement("div");
  stars.style.cssText = "color:#f59e0b;font-size:10px;margin-top:4px";
  stars.textContent = "★".repeat(d.importance) + "☆".repeat(Math.max(0, 5 - d.importance));
  tip.appendChild(stars);
}

const Graph = forwardRef<GraphHandle, Props>(function Graph(
  { data, activeProject, dimmedIds, highlightedIds, clusters, showClusters, onNodeClick, onClusterClick },
  ref
) {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const simNodesRef = useRef<RawNode[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<d3.Simulation<RawNode, RawLink> | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const fitBoundsRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  useImperativeHandle(ref, () => ({
    zoomToNode(id: number) {
      const node = simNodesRef.current.find(n => n.id === id);
      const svgEl = svgRef.current;
      if (!node || !zoomRef.current || !svgEl) return;
      const W = svgEl.clientWidth || 900;
      const H = svgEl.clientHeight || 600;
      d3.select(svgEl).transition().duration(600).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(W / 2 - (node.x ?? 0), H / 2 - (node.y ?? 0)).scale(1.5)
      );
    },
    fitToScreen() {
      fitBoundsRef.current?.();
    },
    resetSimulation() {
      simRef.current?.alpha(1).restart();
    },
  }), []);

  // Main effect: build simulation. Reruns when data or theme changes.
  useEffect(() => {
    const isDark = resolvedTheme !== "light";
    const graphColors = {
      memory: isDark ? "#1e4a7a" : "#dbeafe",
      memoryStroke: isDark ? "#58a6ff" : "#1d4ed8",
      project: isDark ? "#1a4731" : "#dcfce7",
      projectStroke: isDark ? "#3fb950" : "#16a34a",
      linkStroke: isDark ? "#30363d" : "#d0d7de",
      labelFill: isDark ? "#e6edf3" : "#1f2328",
      labelFillMuted: isDark ? "#6b7280" : "#656d76",
    };

    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Create tooltip div once, reuse across data changes
    if (!tooltipRef.current) {
      const tip = document.createElement("div");
      tip.style.cssText = [
        "position:fixed", "visibility:hidden", "pointer-events:none",
        "z-index:9999", "max-width:280px",
        "border-radius:8px", "padding:8px 10px",
        "font-size:11px", "line-height:1.5",
      ].join(";");
      document.body.appendChild(tip);
      tooltipRef.current = tip;
    }
    const tip = tooltipRef.current;
    // Update tooltip theme on each effect run (theme may have changed)
    tip.style.background = isDark ? "#1c2333" : "#ffffff";
    tip.style.border = `1px solid ${isDark ? "#374151" : "#d0d7de"}`;
    tip.style.boxShadow = isDark ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.15)";

    const width = svgEl.clientWidth || 900;
    const height = svgEl.clientHeight || 600;
    const g = svg.append("g");

    // Cache selection for zoom handler — avoids DOM query on every zoom tick
    let memoryLabels: d3.Selection<SVGTextElement, RawNode, SVGGElement, unknown> | null = null;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        if (memoryLabels) {
          memoryLabels.attr("opacity", Math.max(0, (event.transform.k - 0.8) / 0.4));
        }
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    const defs = svg.append("defs");
    // Glow filter for project nodes
    const filter = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "3").attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Search highlight glow filter (stronger blue)
    const searchFilter = defs.append("filter").attr("id", "glow-search").attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
    searchFilter.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "5").attr("result", "blur");
    const sfeMerge = searchFilter.append("feMerge");
    sfeMerge.append("feMergeNode").attr("in", "blur");
    sfeMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Build clusterId lookup from clusters prop
    const nodeClusterMap = new Map<number, string>();
    if (clusters && showClusters) {
      for (const cl of clusters) {
        for (const nid of cl.node_ids) nodeClusterMap.set(nid, cl.id);
      }
    }

    const rawNodes: RawNode[] = data.nodes.map(n => ({
      id: n.id,
      label: n.label,
      content: n.content,
      category: n.category,
      importance: n.importance,
      project_scope: n.project_scope,
      is_project: "is_project" in n ? true : undefined,
      is_context: "is_context" in n ? true : undefined,
      clusterId: nodeClusterMap.get(n.id),
      _original: n,
    }));
    simNodesRef.current = rawNodes;

    const nodeById = new Map(rawNodes.map(n => [n.id, n]));

    const rawLinks: RawLink[] = data.links.flatMap(l => {
      const src = nodeById.get(typeof l.source === "number" ? l.source : (l.source as GraphNode).id);
      const tgt = nodeById.get(typeof l.target === "number" ? l.target : (l.target as GraphNode).id);
      return src && tgt ? [{ source: src, target: tgt, type: l.type }] : [];
    });

    const linkForce = d3.forceLink<RawNode, RawLink>(rawLinks).id(d => d.id)
      .distance(50)
      .strength(d => {
        if (d.type === "context_of") return 0.04;    // context items float loosely
        if (d.type === "project_scope") return 0.25; // project members: moderate pull
        return 0.6;                                   // memory relations: strong
      });

    // Cluster centroid force: pull nodes toward their cluster's centroid
    const clusterCentroidForce = () => {
      if (!clusters || !showClusters) return;
      const centroids = new Map<string, { x: number; y: number; count: number }>();
      for (const n of rawNodes) {
        if (!n.clusterId) continue;
        const c = centroids.get(n.clusterId) ?? { x: 0, y: 0, count: 0 };
        centroids.set(n.clusterId, { x: c.x + (n.x ?? 0), y: c.y + (n.y ?? 0), count: c.count + 1 });
      }
      for (const n of rawNodes) {
        if (!n.clusterId) continue;
        const c = centroids.get(n.clusterId);
        if (!c || c.count < 2) continue;
        const cx = c.x / c.count;
        const cy = c.y / c.count;
        const strength = 0.12;
        n.vx = (n.vx ?? 0) + (cx - (n.x ?? 0)) * strength;
        n.vy = (n.vy ?? 0) + (cy - (n.y ?? 0)) * strength;
      }
    };

    const simulation = d3.forceSimulation<RawNode>(rawNodes)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody<RawNode>().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force("collision", d3.forceCollide<RawNode>().radius(d => nodeRadius(d.importance, d.is_project, d.is_context) + 2))
      .force("cluster", clusterCentroidForce as d3.Force<RawNode, RawLink>)
      .alphaDecay(0.025);
    simRef.current = simulation;

    // Cluster hull group — rendered before links so hulls appear behind everything
    const hullGroup = g.append("g").attr("class", "cluster-hulls");
    const clusterMap = new Map<string, Cluster>();
    if (clusters && showClusters) {
      for (const cl of clusters) clusterMap.set(cl.id, cl);
    }

    const link = g.selectAll<SVGLineElement, RawLink>("line")
      .data(rawLinks)
      .join("line")
      .attr("stroke", graphColors.linkStroke)
      .attr("stroke-width", d => d.type === "project_scope" ? 1 : 0.8)
      .attr("stroke-opacity", 0.7)
      .attr("stroke-dasharray", d => d.type === "context_of" ? "2,2" : null);

    const node = g.selectAll<SVGGElement, RawNode>("g.node")
      .data(rawNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        if (d.is_project) {
          router.push(`/project/${encodeURIComponent(d.label)}`);
        } else {
          onNodeClick(d._original);
        }
      })
      .on("mouseenter", (event: MouseEvent, d: RawNode) => {
        populateTooltip(tip, d, isDark);
        tip.style.visibility = "visible";
        tip.style.left = `${event.clientX + 14}px`;
        tip.style.top = `${event.clientY - 10}px`;
      })
      .on("mousemove", (event: MouseEvent) => {
        tip.style.left = `${event.clientX + 14}px`;
        tip.style.top = `${event.clientY - 10}px`;
      })
      .on("mouseleave", () => { tip.style.visibility = "hidden"; })
      .call(
        d3.drag<SVGGElement, RawNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    node.append("circle")
      .attr("class", "node-circle")
      .attr("r", d => nodeRadius(d.importance, d.is_project, d.is_context))
      .attr("fill", d => nodeColor(d.category))
      .attr("fill-opacity", d => d.is_project ? 1 : 0.85)
      .attr("stroke", d => d.is_project ? nodeColor(d.category) : "transparent")
      .attr("stroke-width", d => d.is_project ? 1.5 : 0)
      .attr("filter", d => d.is_project ? "url(#glow)" : null);

    // Project labels — always visible
    node.filter(d => !!d.is_project)
      .append("text")
      .attr("class", "node-label-project")
      .attr("dy", d => nodeRadius(d.importance, d.is_project, d.is_context) + 9)
      .attr("text-anchor", "middle")
      .attr("font-size", 8)
      .attr("fill", d => nodeColor(d.category))
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text(d => d.label.length > 14 ? d.label.substring(0, 13) + "…" : d.label);

    // Important node labels (importance >= 4) — always visible at all zoom levels
    node.filter(d => !d.is_project && d.importance >= 4)
      .append("text")
      .attr("class", "node-label-important")
      .attr("dy", d => nodeRadius(d.importance, d.is_project, d.is_context) + 7)
      .attr("text-anchor", "middle")
      .attr("font-size", 7)
      .attr("fill", graphColors.labelFill)
      .attr("pointer-events", "none")
      .text(d => d.label.length > 18 ? d.label.substring(0, 17) + "…" : d.label);

    // Memory labels (importance < 4) — only visible when zoomed in
    node.filter(d => !d.is_project && d.importance < 4)
      .append("text")
      .attr("class", "node-label-memory")
      .attr("dy", d => nodeRadius(d.importance, d.is_project, d.is_context) + 7)
      .attr("text-anchor", "middle")
      .attr("font-size", 6)
      .attr("fill", graphColors.labelFillMuted)
      .attr("pointer-events", "none")
      .text(d => d.label.length > 16 ? d.label.substring(0, 15) + "…" : d.label);

    // Populate cached selection — only zoom-faded labels (not important ones)
    memoryLabels = g.selectAll<SVGTextElement, RawNode>(".node-label-memory");

    const fitBounds = () => {
      const nodes = simNodesRef.current;
      if (nodes.length === 0) return;
      const bounds = nodes.reduce(
        (acc, n) => ({
          minX: Math.min(acc.minX, n.x ?? 0), maxX: Math.max(acc.maxX, n.x ?? 0),
          minY: Math.min(acc.minY, n.y ?? 0), maxY: Math.max(acc.maxY, n.y ?? 0),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      );
      const x0 = bounds.minX - 40, x1 = bounds.maxX + 40;
      const y0 = bounds.minY - 40, y1 = bounds.maxY + 40;
      const scale = Math.min(width / (x1 - x0), height / (y1 - y0), 1);
      const tx = (width - scale * (x0 + x1)) / 2;
      const ty = (height - scale * (y0 + y1)) / 2;
      d3.select(svgEl).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };
    fitBoundsRef.current = fitBounds;
    simulation.on("end", fitBounds);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x ?? 0)
        .attr("y1", d => d.source.y ?? 0)
        .attr("x2", d => d.target.x ?? 0)
        .attr("y2", d => d.target.y ?? 0);
      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);

      // Recompute hull paths grouped by clusterId
      if (clusters && showClusters && clusters.length > 0) {
        type HullDatum = { id: string; pts: [number, number][]; cluster: Cluster };
        const pointsByCluster = new Map<string, [number, number][]>();
        for (const n of rawNodes) {
          if (!n.clusterId) continue;
          const pts = pointsByCluster.get(n.clusterId) ?? [];
          pts.push([n.x ?? 0, n.y ?? 0]);
          pointsByCluster.set(n.clusterId, pts);
        }

        const hullData = [...pointsByCluster.entries()]
          .map(([id, pts]) => ({ id, pts, cluster: clusterMap.get(id) }))
          .filter((h): h is HullDatum => h.cluster != null);

        hullGroup
          .selectAll<SVGPathElement, HullDatum>("path.cluster-hull")
          .data(hullData, d => d.id)
          .join(
            enter => enter.append("path")
              .attr("class", "cluster-hull")
              .attr("fill-opacity", 0.08)
              .attr("stroke-opacity", 0.4)
              .attr("stroke-width", 1.5)
              .attr("stroke-dasharray", "4,3")
              .style("cursor", "pointer")
              // Event listeners attached once on enter, not re-bound every tick
              .on("mouseenter", function(event: MouseEvent, d) {
                d3.select(this).attr("fill-opacity", 0.15);
                tip.style.visibility = "visible";
                tip.style.left = `${event.clientX + 14}px`;
                tip.style.top = `${event.clientY - 10}px`;
                while (tip.firstChild) tip.removeChild(tip.firstChild);
                const label = document.createElement("div");
                label.style.cssText = `color:${isDark ? "#e5e7eb" : "#1f2328"};font-weight:600`;
                label.textContent = d.cluster.label;
                tip.appendChild(label);
                const count = document.createElement("div");
                count.style.cssText = `color:${isDark ? "#9ca3af" : "#656d76"};font-size:10px`;
                count.textContent = `${d.pts.length} nodes`;
                tip.appendChild(count);
              })
              .on("mousemove", (event: MouseEvent) => {
                tip.style.left = `${event.clientX + 14}px`;
                tip.style.top = `${event.clientY - 10}px`;
              })
              .on("mouseleave", function() {
                d3.select(this).attr("fill-opacity", 0.08);
                tip.style.visibility = "hidden";
              })
              .on("click", (_event, d) => { onClusterClick?.(d.id); }),
            update => update
          )
          // Update dynamic attrs on every tick (enter + update)
          .attr("d", d => hullPath(d.pts))
          .attr("fill", d => d.cluster.color)
          .attr("stroke", d => d.cluster.color);
      }
    });

    return () => {
      simulation.stop();
      tip.style.visibility = "hidden";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, resolvedTheme, clusters, showClusters]);

  // Cleanup tooltip div on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  // Highlight activeProject without rebuilding simulation
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    d3.select(svgEl).selectAll<SVGCircleElement, RawNode>("circle.node-circle")
      .attr("stroke", d => activeProject && d.project_scope === activeProject ? "#ffffff" : "#1f2937")
      .attr("stroke-width", d => activeProject && d.project_scope === activeProject ? 2.5 : 1);
  }, [activeProject]);

  // Dim nodes not matching active tag filter
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    d3.select(svgEl).selectAll<SVGGElement, RawNode>("g.node")
      .attr("opacity", d => dimmedIds?.size && dimmedIds.has(d.id) ? 0.15 : 1);
  }, [dimmedIds]);

  // Highlight search-matched nodes with a blue glow
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const circles = d3.select(svgEl).selectAll<SVGCircleElement, RawNode>("circle.node-circle");
    if (highlightedIds?.size) {
      circles
        .attr("stroke", d => {
          if (highlightedIds.has(d.id)) return "#60a5fa";
          if (activeProject && d.project_scope === activeProject) return "#ffffff";
          return "#1f2937";
        })
        .attr("stroke-width", d => highlightedIds.has(d.id) || (!!activeProject && d.project_scope === activeProject) ? 2.5 : 1)
        .attr("filter", d => d.is_project ? "url(#glow)" : (highlightedIds.has(d.id) ? "url(#glow-search)" : null));
    } else {
      circles
        .attr("stroke", d => activeProject && d.project_scope === activeProject ? "#ffffff" : "#1f2937")
        .attr("stroke-width", d => activeProject && d.project_scope === activeProject ? 2.5 : 1)
        .attr("filter", d => d.is_project ? "url(#glow)" : null);
    }
  }, [highlightedIds, activeProject]);

  return <svg ref={svgRef} className="w-full h-full bg-[var(--bg-primary)]" />;
});

export default Graph;
