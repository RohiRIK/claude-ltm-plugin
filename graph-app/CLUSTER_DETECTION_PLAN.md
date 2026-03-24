# Cluster Auto-Detection Implementation Plan

## Executive Summary

Add community detection to the LTM memory graph with visual cluster boundaries, auto-generated labels, and user management controls. This will help users identify emergent themes and knowledge domains within their memory network.

---

## Current Architecture Analysis

### D3 Graph Setup
- **Force Simulation**: Uses `d3.forceSimulation` with:
  - Link force (distance 30-100 based on edge type)
  - Charge force (strength -80, repulsion)
  - Center force (strength 0.08)
  - Collision detection (radius based on importance)
  - Alpha decay 0.025 (slow stabilization)
- **Node Types**: `RawNode` with `id`, `label`, `content`, `category`, `importance`, `project_scope`, `is_project`, `is_context`
- **Edge Types**: Stored in `memory_relations` table with 6 relationship types: `supports`, `contradicts`, `refines`, `depends_on`, `related_to`, `supersedes`
- **Rendering**: SVG-based with zoom/pan (`d3.zoom`), drag interaction, tooltip overlays
- **Colors**: Category-based via `nodeColor()` function

### Data Flow
1. **Backend** (`server.ts`): SQLite queries → REST endpoints → WebSocket live updates
2. **API Layer** (`api.ts`): Fetch wrappers for `/api/graph`, `/api/memory/:id`, `/api/reasoning/:id`
3. **Frontend** (`page.tsx`): State management with React hooks, filters (importance, project, tags, search)
4. **Graph Component** (`Graph.tsx`): D3 rendering, simulation lifecycle, event handlers
5. **Sidebar** (`Sidebar.tsx`): Panel pattern for node details, reasoning chains, project context

### Graph Reasoning Engine
- **BFS Traversal** (`graph.ts`): `traverseGraph(startId, depth=2)` walks memory relations
- **Output**: `chain` (BFS order), `conflicts`, `reinforcements`, `clusters` (currently just connected components)
- **Current Clustering**: Basic connected component detection via union-find — **not community-based**

### UI Patterns
- **Sidebar Panel**: Right-side drawer with header gradient, close button, tabbed content (see `ProjectPanel`, `MemoryPanel`, `ReasoningPanel`)
- **Modal Overlay**: `SpotlightModal` for search (backdrop blur, center positioning)
- **State Updates**: Uses `useState` + `useEffect` with WebSocket `onmessage` handler for live sync

### Dependencies
- `d3@^7.9.0` (no specialized graph libs)
- `next@^15.2.0`, `react@^19.0.0`
- Bun runtime (fast TypeScript execution)

---

## Implementation Plan

### Phase 1: Backend Algorithm (Community Detection)

**Files to Create:**
- `/Users/rohirikman/.claude/memory/cluster.ts` — Community detection engine

**Files to Modify:**
- `/Users/rohirikman/.claude/memory/graph.ts` — Replace basic clustering with community detection
- `/Users/rohirikman/.claude/memory/server.ts` — Add cluster endpoints

**Technical Decisions:**
- **Algorithm**: **Label Propagation** (simpler, faster, incremental-friendly) over Louvain
  - Louvain requires modularity recalculation on every graph change (expensive)
  - Label Propagation: iterative label spreading, converges fast, O(n+m) per iteration
  - Trade-off: Label Propagation less stable (order-dependent), but better for live updates
- **Implementation**:
  ```typescript
  interface Cluster {
    id: string; // UUID
    label: string; // Auto-generated from tags/topics
    node_ids: number[]; // Memory IDs in this cluster
    color: string; // Distinct color per cluster
    created_at: string;
    updated_at: string;
  }
  
  function detectCommunities(nodes: MemoryNode[], edges: Edge[]): Cluster[] {
    // Label Propagation Algorithm:
    // 1. Initialize each node with unique label (its ID)
    // 2. Iterate: each node adopts most frequent label among neighbors
    // 3. Converge when labels stabilize (max 20 iterations)
    // 4. Group nodes by final label → clusters
  }
  
  function generateClusterLabel(cluster: Cluster, memories: MemoryNode[]): string {
    // Extract tags from all memories in cluster
    // Use TF-IDF or simple frequency to find top 2-3 common terms
    // Fallback to "Cluster {id}" if no clear theme
  }
  ```
- **Caching**: Store clusters in new SQLite table `memory_clusters`:
  ```sql
  CREATE TABLE memory_clusters (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    node_ids TEXT NOT NULL, -- JSON array
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE cluster_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id TEXT NOT NULL,
    override_type TEXT CHECK(override_type IN ('label', 'merge', 'split')),
    override_data TEXT NOT NULL, -- JSON
    created_at TEXT NOT NULL
  );
  ```
- **Incremental Updates**: 
  - On new memory: re-run label propagation only on affected subgraph (BFS neighbors within depth=3)
  - On new relation: merge/split clusters if modularity changes significantly
  - Cache invalidation: WebSocket broadcast `{type: 'clusters_updated'}`

**API Endpoints**:
```typescript
GET  /api/clusters              → Cluster[]
POST /api/clusters/:id/label    → {label: string} (user override)
POST /api/clusters/merge        → {cluster_ids: string[]} → new Cluster
POST /api/clusters/:id/split    → {node_ids: number[][]} → Cluster[]
GET  /api/clusters/:id/summary  → {cluster: Cluster, memories: MemoryNode[], stats: {}}
```

---

### Phase 2: Frontend Rendering (Cluster Boundaries)

**Files to Create:**
- `/Users/rohirikman/.claude/memory/graph-app/lib/clusterColors.ts` — Color palette generator
- `/Users/rohirikman/.claude/memory/graph-app/lib/convexHull.ts` — Hull computation

**Files to Modify:**
- `/Users/rohirikman/.claude/memory/graph-app/components/Graph.tsx` — Render cluster hulls
- `/Users/rohirikman/.claude/memory/graph-app/lib/types.ts` — Add `Cluster` type

**Technical Decisions:**
- **Visual Approach**: **Convex hulls with padding** (clearer than Voronoi, easier than force-directed bubbles)
  - Draw SVG `<path>` behind nodes, using D3's `d3.polygonHull()`
  - Add 15-20px padding around hull boundary
  - Semi-transparent fill, subtle stroke
- **Alternative Considered**: Shaded Voronoi regions
  - Rejected: overlapping clusters wouldn't work (Voronoi partitions space)
- **Rendering Order**: `hulls → links → nodes` (z-index via SVG append order)
- **Color Palette**: Use HSL with distributed hues (avoid similar colors for adjacent clusters)
  ```typescript
  function generateClusterColors(count: number): string[] {
    const hueStep = 360 / count;
    return Array.from({length: count}, (_, i) => 
      `hsl(${i * hueStep}, 65%, 55%)`
    );
  }
  ```
- **Interaction**:
  - Hover hull → highlight all nodes, show cluster label tooltip
  - Click hull → open cluster summary panel
  - Right-click hull → context menu (edit label, merge, split, hide)
- **Performance**: 
  - Recalculate hulls only on simulation `end` event (not every tick)
  - Use `d3.polygonHull()` — O(n log n) per cluster, fast for <100 nodes

**Implementation Sketch**:
```typescript
// In Graph.tsx useEffect (after node/link rendering)
const hullPadding = 20;
const hulls = g.selectAll<SVGPathElement, Cluster>("path.cluster-hull")
  .data(clusters)
  .join("path")
  .attr("class", "cluster-hull")
  .attr("fill", d => d.color)
  .attr("fill-opacity", 0.15)
  .attr("stroke", d => d.color)
  .attr("stroke-width", 1.5)
  .attr("stroke-opacity", 0.4)
  .attr("stroke-dasharray", "4,4")
  .style("cursor", "pointer")
  .on("click", (event, d) => onClusterClick(d));

simulation.on("end", () => {
  hulls.attr("d", d => {
    const points = d.node_ids
      .map(id => nodeById.get(id))
      .filter(n => n && n.x !== undefined && n.y !== undefined)
      .map(n => [n.x!, n.y!] as [number, number]);
    const hull = d3.polygonHull(points);
    if (!hull) return null;
    // Add padding by offsetting each point away from centroid
    const centroid = d3.polygonCentroid(hull);
    const padded = hull.map(([x, y]) => {
      const dx = x - centroid[0];
      const dy = y - centroid[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      return [x + dx/dist * hullPadding, y + dy/dist * hullPadding];
    });
    return `M${padded.join("L")}Z`;
  });
});
```

---

### Phase 3: UI Panels (Cluster Management)

**Files to Create:**
- `/Users/rohirikman/.claude/memory/graph-app/components/ClusterPanel.tsx` — Cluster summary sidebar
- `/Users/rohirikman/.claude/memory/graph-app/components/ClusterControls.tsx` — Merge/split/rename UI

**Files to Modify:**
- `/Users/rohirikman/.claude/memory/graph-app/components/Sidebar.tsx` — Add `ClusterPanel` case
- `/Users/rohirikman/.claude/memory/graph-app/app/page.tsx` — Cluster state management

**UI Components**:

1. **ClusterPanel** (sidebar when cluster clicked):
   ```typescript
   interface ClusterPanelProps {
     cluster: Cluster;
     memories: MemoryNode[];
     onClose: () => void;
     onLabelEdit: (newLabel: string) => void;
     onMerge: (targetClusterId: string) => void;
     onSplit: (groups: number[][]) => void;
   }
   ```
   - Header: Cluster label (editable inline), color badge, node count
   - Stats: Avg importance, category breakdown, tag cloud
   - Memory list: Grouped by category, click to zoom/select
   - Actions: "Merge with...", "Split cluster", "Hide cluster"

2. **ClusterControls** (toolbar at top-right):
   - Toggle cluster visibility (show/hide hulls)
   - "Re-cluster" button (force re-detection)
   - Cluster count badge

3. **Merge Modal**:
   - Dropdown to select target cluster
   - Preview: combined node count, merged tags
   - Confirm → POST `/api/clusters/merge`

4. **Split UI**:
   - Enable "lasso mode" — drag to draw selection polygon
   - Multi-select nodes → group 1, remaining → group 2
   - Confirm → POST `/api/clusters/:id/split`

**State Management**:
```typescript
// In page.tsx
const [clusters, setClusters] = useState<Cluster[]>([]);
const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
const [clustersVisible, setClustersVisible] = useState(true);

useEffect(() => {
  api.clusters().then(setClusters);
}, []);

// WebSocket listener
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'clusters_updated') {
    api.clusters().then(setClusters);
  }
};
```

---

### Phase 4: Auto-Generated Labels

**Files to Modify:**
- `/Users/rohirikman/.claude/memory/cluster.ts` — Label generation logic

**Technical Approach**:
- **Tag-Based Labels**: 
  1. Extract all tags from memories in cluster
  2. Compute tag frequency (TF) and cluster specificity (IDF across all clusters)
  3. Pick top 2-3 tags by TF-IDF score
  4. Join with " + " → "React + Hooks + Performance"
- **Content-Based Fallback** (if <3 common tags):
  1. Extract noun phrases from memory content (simple regex: capitalized words, hyphenated terms)
  2. Use frequency → "Authentication + Database + API"
- **Fallback**: "Cluster {category}" if no clear pattern (e.g., "Cluster Architecture")
- **User Override**: Store in `cluster_overrides` table, always prioritize user label

**Implementation**:
```typescript
function generateLabel(cluster: Cluster, memories: MemoryNode[]): string {
  const allTags = memories.flatMap(m => m.tags);
  const tagCounts = countFrequency(allTags);
  const topTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => tag);
  
  if (topTags.length >= 2) {
    return topTags.join(" + ");
  }
  
  // Fallback: use most common category
  const categories = memories.map(m => m.category);
  const topCategory = mode(categories);
  return `Cluster ${capitalize(topCategory)}`;
}
```

---

### Phase 5: Incremental Updates

**Files to Modify:**
- `/Users/rohirikman/.claude/memory/cluster.ts` — Incremental clustering
- `/Users/rohirikman/.claude/memory/db.ts` — Trigger cluster updates on memory insert/relation insert

**Strategy**:
- **Trigger Points**:
  1. New memory added → re-cluster if >10 new memories since last run
  2. New relation added → re-cluster only if cross-cluster edge (potential merge)
  3. Manual trigger via "Re-cluster" button
- **Partial Re-clustering**:
  ```typescript
  function incrementalCluster(
    existingClusters: Cluster[],
    newNodes: number[],
    graph: Graph
  ): Cluster[] {
    // 1. Run label propagation only on new nodes + 2-hop neighbors
    const affectedNodes = new Set(newNodes);
    for (const nodeId of newNodes) {
      const neighbors = getNeighbors(graph, nodeId, depth=2);
      neighbors.forEach(n => affectedNodes.add(n));
    }
    
    // 2. Re-run label propagation on subgraph
    const subgraph = extractSubgraph(graph, [...affectedNodes]);
    const newLabels = labelPropagation(subgraph);
    
    // 3. Merge results with existing clusters
    return mergeClusters(existingClusters, newLabels);
  }
  ```
- **Stability**: Add hysteresis — only update cluster if membership changes by >20%
- **Performance**: Cap incremental updates to 1/minute, batch changes

---

## File Manifest

### New Files (7):
1. `/Users/rohirikman/.claude/memory/cluster.ts` — Community detection engine
2. `/Users/rohirikman/.claude/memory/graph-app/lib/clusterColors.ts` — Color palette
3. `/Users/rohirikman/.claude/memory/graph-app/lib/convexHull.ts` — Hull utilities
4. `/Users/rohirikman/.claude/memory/graph-app/components/ClusterPanel.tsx` — Cluster sidebar
5. `/Users/rohirikman/.claude/memory/graph-app/components/ClusterControls.tsx` — Toolbar controls
6. `/Users/rohirikman/.claude/memory/graph-app/components/MergeModal.tsx` — Merge UI
7. `/Users/rohirikman/.claude/memory/graph-app/components/SplitModal.tsx` — Split UI

### Modified Files (7):
1. `/Users/rohirikman/.claude/memory/graph.ts` — Replace `buildClusters()` with `detectCommunities()`
2. `/Users/rohirikman/.claude/memory/server.ts` — Add 5 cluster endpoints
3. `/Users/rohirikman/.claude/memory/db.ts` — Add cluster update triggers
4. `/Users/rohirikman/.claude/memory/schema.sql` — Add 2 tables (`memory_clusters`, `cluster_overrides`)
5. `/Users/rohirikman/.claude/memory/graph-app/components/Graph.tsx` — Render convex hulls
6. `/Users/rohirikman/.claude/memory/graph-app/components/Sidebar.tsx` — Add cluster panel case
7. `/Users/rohirikman/.claude/memory/graph-app/app/page.tsx` — Cluster state + WebSocket updates
8. `/Users/rohirikman/.claude/memory/graph-app/lib/types.ts` — Add `Cluster` interface
9. `/Users/rohirikman/.claude/memory/graph-app/lib/api.ts` — Add cluster API wrappers

---

## Risks & Gotchas

### High Risk:
1. **Performance Degradation**: Label propagation on 1000+ nodes could freeze UI
   - **Mitigation**: Run in Web Worker, show progress indicator, cap iterations at 20
2. **Cluster Instability**: Label propagation order-dependent, clusters might "flicker"
   - **Mitigation**: Add 20% hysteresis threshold, debounce updates to 1/min
3. **Hull Overlap**: Convex hulls may overlap heavily in dense graphs
   - **Mitigation**: Add opacity control, allow users to hide specific clusters

### Medium Risk:
4. **Color Collisions**: Auto-generated colors might be similar for adjacent clusters
   - **Mitigation**: Use graph coloring algorithm (greedy, assign dissimilar colors to connected clusters)
5. **Label Quality**: Auto-labels may be too generic ("Cluster Pattern", "Cluster Workflow")
   - **Mitigation**: Allow users to mark "good labels" to train heuristic weights

### Low Risk:
6. **WebSocket Thundering Herd**: Many clients re-fetching clusters on broadcast
   - **Mitigation**: Add 500ms random jitter to refetch timing
7. **SQLite Write Lock**: Cluster table updates blocking memory inserts
   - **Mitigation**: Use separate connection for cluster writes, or move to in-memory cache

---

## Complexity Estimate

- **Backend (cluster.ts + endpoints)**: 🔵🔵🔵⚪⚪ (3/5) — Label propagation is straightforward, incremental logic is tricky
- **Frontend Rendering (hulls)**: 🔵🔵⚪⚪⚪ (2/5) — D3 hull rendering is simple, performance tuning needed
- **UI Panels**: 🔵🔵🔵⚪⚪ (3/5) — Standard CRUD UI, merge/split interactions are complex
- **Incremental Updates**: 🔵🔵🔵🔵⚪ (4/5) — Trigger logic, cache invalidation, race conditions
- **Auto-Labels**: 🔵🔵⚪⚪⚪ (2/5) — TF-IDF is standard, fallback heuristics need iteration

**Overall**: 🔵🔵🔵⚪⚪ (3/5) — Medium complexity. Core algorithm is well-known, main challenges are UI polish and performance.

---

## Implementation Phases (Suggested Order)

1. **Phase 1**: Backend algorithm + DB schema (2-3 days)
   - Implement label propagation
   - Add SQLite tables + endpoints
   - Test with manual API calls
2. **Phase 2**: Hull rendering (1 day)
   - Draw convex hulls in Graph.tsx
   - Add toggle visibility control
3. **Phase 3**: Cluster panel + basic interactions (2 days)
   - ClusterPanel sidebar
   - Click to select, view members
4. **Phase 4**: Auto-labels (1 day)
   - Tag-based label generation
   - User override UI
5. **Phase 5**: Merge/split + incremental updates (2-3 days)
   - Merge/split modals
   - Incremental clustering logic
   - WebSocket sync

**Total Estimate**: 8-10 days (full-time)

---

## Open Questions

1. **Should clusters be project-scoped or global?**
   - Global: easier to see cross-project patterns
   - Project-scoped: cleaner visualization, less noise
   - **Recommendation**: Global by default, filter by active project in UI

2. **Min/max cluster size?**
   - Too small (<3 nodes): noise
   - Too large (>50 nodes): not useful
   - **Recommendation**: Filter out clusters <3 nodes, split suggestions for >50

3. **Persist cluster membership or recompute on load?**
   - Persist: faster, stable across sessions
   - Recompute: always fresh, adapts to graph changes
   - **Recommendation**: Persist + background recomputation every 5min

4. **Should conflicting edges (contradicts, supersedes) affect clustering?**
   - Yes: treat as negative weights (push nodes apart)
   - No: ignore edge type, cluster purely on connectivity
   - **Recommendation**: Start simple (ignore type), add weighted clustering in v2
