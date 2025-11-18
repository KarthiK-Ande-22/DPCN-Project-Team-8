# Hyderabad Transport Network - Resilience & Greedy Recommender

## Project Overview

This is a comprehensive React-based web application that simulates transport network failures in Hyderabad's multi-modal transit system and automatically recommends optimal new links using a greedy algorithm.

## System Architecture

### Frontend Stack
- **React 18.2.0**: Core UI framework
- **Ant Design 5.11.5**: Professional UI component library
- **Leaflet 1.9.4**: Interactive mapping
- **Plotly.js 2.27.0**: Data visualization (reserved for future charts)
- **Graphology 0.25.4**: High-performance graph data structure & algorithms

### Key Components

#### 1. App.js (Main Application)
The central component managing:
- **State Management**: Controls, results, graphs, progress
- **Data Loading**: Async CSV parsing from public folder
- **Scenario Execution**: Orchestrates entire analysis workflow
- **UI Layout**: Three-column responsive design (controls | metrics | visuals)

**Key Functions:**
```javascript
loadNetworkData() // Fetch and parse nodes.csv, edges.csv
runScenario()     // Execute failure simulation + recommendation
calculateDelta()  // Compute percentage changes
generateSummary() // Create narrative summary
```

#### 2. NetworkMap.jsx (Leaflet Component)
Interactive map visualization featuring:
- **Layer-colored edges**: Metro (red), MMTS (blue), Bus (green), Auto (orange)
- **Failed node highlighting**: Red circles with white borders
- **Recommended links**: Dashed green lines with popups
- **Automatic bounds fitting**: Centers on network extent
- **Popup information**: Node names, layers, failure status

#### 3. graphAlgorithms.js (Core Logic)
Implements all network analysis algorithms:

**buildGraph(nodes, edges, objective, todMultiplier)**
- Creates weighted graphology instance
- Supports 3 objectives: time, cost, transfers
- Applies time-of-day congestion multipliers
- Edge weights calculated from:
  - Express bus: 35 km/h, ₹3/km
  - Cross-rail walk: 5 km/h, ₹0/km
  - Default bus: 25 km/h, ₹2.5/km

**computeShortestPath(graph, source, target, objective)**
- Bidirectional Dijkstra's algorithm
- Returns: {path, distance, transfers, time, cost}
- Counts mode changes as transfers
- Handles unreachable nodes gracefully

**applyFailure(graph, failureType, failureTargets)**
- Three failure modes:
  - 'node': Remove nodes and adjacent edges
  - 'edge': Remove specific edges (bidirectional)
  - 'layer': Remove all nodes of specified layer(s)
- Returns new graph (immutable operation)

**computeMetrics(graph, odPairs, objective)**
- Aggregates statistics across all OD pairs:
  - avgTime, avgCost, avgTransfers
  - disconnected count
  - Individual results array
- Skips unreachable pairs in averages

**generateCandidates(nodes, originalGraph, failedGraph, scenarioResults)**
- Four deterministic strategies:
  1. **Hub neighbors** (priority 10): Bus hubs 2-6km apart, not in original graph
  2. **Cross-rail** (priority 8): Metro ↔ MMTS stations 0.5-4km apart
  3. **OD-driven** (priority 7): Direct links for top 5 most degraded OD pairs
  4. **Express hubs** (priority 6): Major hubs 3-15km apart, different regions
- Returns max 30 candidates, sorted by priority
- Filters duplicates and existing edges

**greedyRecommendation(failedGraph, candidates, odPairs, budget, objective, progressCallback)**
- Iterative greedy algorithm:
  1. Evaluate each remaining candidate
  2. Temporarily add edge, compute metrics
  3. Calculate improvement vs current state
  4. Select candidate with maximum improvement
  5. Add permanently, remove from candidates
  6. Repeat until budget exhausted or no improvement
- Progress callbacks for UI updates
- Returns: {selectedLinks, finalGraph, finalMetrics}

### Data Flow

```
User Sets Parameters
    ↓
Click "Run Scenario"
    ↓
Build Original Graph (buildGraph)
    ↓
Compute Baseline Metrics (computeMetrics)
    ↓
Apply Failure (applyFailure)
    ↓
Compute Scenario Metrics
    ↓
Identify Top Affected Pairs
    ↓
[If Budget > 0]
    ↓
Generate Candidates (generateCandidates)
    ↓
Greedy Selection Loop:
  - Evaluate each candidate
  - Select best improvement
  - Add to graph permanently
  - Update progress UI
    ↓
Compute Final Metrics
    ↓
Display Results & Maps
```

## Input Files

### nodes.csv
Required columns:
- `node_id`: Unique identifier (e.g., "AMEERPET")
- `lat`: Latitude (decimal degrees)
- `lon`: Longitude (decimal degrees)
- `layer`: Transport mode (metro, mmts, bus, auto)
- `name`: Display name (optional)
- `region`: Geographic region (for express hub strategy)
- `Df, Hf, Cf`: Multipliers for density, hub, congestion (optional, default 1)

### edges.csv
Required columns:
- `from_id`: Source node ID
- `to_id`: Target node ID
- `layer`: Primary layer
- `type`: 'service' or 'transfer'
- `distance_km`: Physical distance
- `time_min`: Travel time (optional, calculated if missing)
- `cost_rs`: Monetary cost (optional, calculated if missing)

## UI Controls

### Scenario Parameters

1. **Source/Destination**
   - Autocomplete dropdowns
   - "All" mode: Uses 40 random major OD pairs
   - Specific mode: Single OD pair analysis

2. **Failure Type**
   - Node Down: Remove up to 3 specific nodes
   - Edge Down: Remove specific connections
   - Layer Down: Remove entire transport mode(s)

3. **Objective Function**
   - Fastest Time: Minimize travel time (default)
   - Least Cost: Minimize monetary expense
   - Fewest Transfers: Minimize mode changes

4. **Time of Day**
   - Off-peak: No multiplier (Cf × 1.0)
   - Peak AM: +15% congestion (Cf × 1.15)
   - Peak PM: +20% congestion (Cf × 1.20)

5. **Budget (New Links)**
   - 0: No recommendations
   - 1-10: Quick recommendations
   - Custom: Up to 20 links
   - **Auto-triggers** greedy algorithm if > 0

### Results Display

#### Metrics Cards
- **Before**: Baseline network performance
- **After Failure**: Degraded network metrics
- **Change (Δ%)**: Percentage differences
- **After Recommendations**: Fixed network (if budget > 0)

Metrics tracked:
- Average travel time (minutes)
- Average cost (₹)
- Average transfers (count)
- Disconnected OD pairs

#### Top 10 Affected Pairs Table
Columns:
- Origin, Destination (names)
- Before time, After time
- Delta % (sorted descending)

#### Maps (Tabbed)
- **Before**: Original network
- **After**: Failed network (red failed nodes)
- **Fixed**: With recommended links (green dashed lines)

#### Recommended Links Panel
For each link:
- Link number tag
- From ↔ To (node names)
- Type (hub_neighbor, cross_rail, od_driven, express_hub)
- Distance (km)
- Estimated time (min)
- Improvement (negative = better, avg time saved)

## Performance Optimization

### Computation Complexity
- **Shortest Path**: O(E log V) per OD pair (bidirectional Dijkstra)
- **Greedy Selection**: O(budget × candidates × OD_pairs × E log V)
- **Worst Case**: budget=10, candidates=30, OD_pairs=40
  → ~12,000 shortest path computations

### Expected Runtime
- Budget 0-2: 1-5 seconds
- Budget 3-5: 5-15 seconds
- Budget 6-10: 15-40 seconds
- Budget > 10: 40+ seconds

### Optimization Strategies
1. **Progress callbacks**: Real-time UI updates prevent perceived freeze
2. **Immutable graphs**: Efficient cloning with graphology
3. **Candidate filtering**: Max 30 candidates, priority-sorted
4. **Bidirectional search**: Faster than unidirectional Dijkstra
5. **Early termination**: Stops if no improvement found

## Example Scenarios

### 1. Major Interchange Failure (Ameerpet)
```
Source: All
Destination: All
Failure Type: Node Down
Failure Hubs: AMEERPET (AME)
Objective: Fastest Time
Time of Day: Peak PM
Budget: 3
```
**Expected Outcome**: 
- ~20-30% time increase
- Recommendations: Metro alternatives, bus express links
- Affected regions: Red/Blue line corridor

### 2. Complete Metro Shutdown
```
Source: All
Destination: All
Failure Type: Layer Down
Selected Layers: metro
Objective: Fastest Time
Time of Day: Off-peak
Budget: 5
```
**Expected Outcome**:
- Massive delays (100%+)
- Heavy reliance on MMTS + Bus
- Recommendations: Express bus hubs, cross-rail links

### 3. North-South Connectivity Loss (Secunderabad)
```
Source: KACHEGUDA
Destination: SECUNDERABAD_JUNCTION
Failure Type: Node Down
Failure Hubs: SECUNDRABAD
Objective: Fewest Transfers
Time of Day: Peak AM
Budget: 2
```
**Expected Outcome**:
- Specific OD pair severely impacted
- Recommendations: Direct alternatives or nearby interchanges

## Deployment

### Development Server
```bash
cd resilience-app
npm install
npm start
```
→ Opens at `http://localhost:3000`

### Production Build
```bash
npm run build
```
→ Creates optimized `build/` folder

### Deployment Options
1. **Static Hosting**: Deploy `build/` to Netlify, Vercel, GitHub Pages
2. **Local Server**: Use `serve -s build` (install via `npm install -g serve`)
3. **Integration**: Embed in existing dashboard via iframe

## Future Enhancements

### Planned Features
1. **Web Worker**: Offload greedy algorithm to prevent UI blocking
2. **Accessibility Charts**: Plotly bar charts showing regional connectivity
3. **Path Visualization**: Overlay shortest paths on map
4. **Scenario Presets**: One-click example scenarios
5. **Export Results**: Download analysis as JSON/CSV
6. **Comparison Mode**: Compare multiple scenarios side-by-side
7. **Real-time Data**: Integrate live GTFS feeds
8. **Advanced Metrics**: Network efficiency, resilience curves

### Code Improvements
1. Add comprehensive error boundaries
2. Implement service worker for offline mode
3. Add unit tests (Jest + React Testing Library)
4. Optimize bundle size (code splitting)
5. Add TypeScript definitions
6. Implement Redux for complex state
7. Add accessibility (ARIA labels, keyboard nav)

## Troubleshooting

### Common Issues

**1. "Network data not loaded"**
- Verify `nodes.csv` and `edges.csv` exist in `public/`
- Check browser console for fetch errors
- Ensure CSV format matches requirements

**2. Maps not rendering**
- Check Leaflet CSS is imported
- Verify node lat/lon are valid numbers
- Look for console errors about missing tiles

**3. Slow performance**
- Reduce budget (< 5 recommended)
- Use specific OD pair instead of "All"
- Check if browser is throttling background tabs

**4. Recommendations seem random**
- Candidates are deterministic but improvement depends on OD sample
- Try different failure scenarios
- Verify edge weights are reasonable

**5. Disconnected OD pairs**
- Normal for severe failures (layer down)
- Check if alternative modes exist in network
- Review candidate generation strategies

## Technical Notes

### Graph Representation
- **Undirected multigraph**: Graphology allows parallel edges
- **Weighted edges**: time/cost/transfers based on objective
- **Node attributes**: lat, lon, layer, name, region
- **Edge attributes**: layer, type, distance, time, cost

### Coordinate System
- **Projection**: WGS84 (EPSG:4326)
- **Distance calculation**: Haversine formula (km)
- **Map tiles**: OpenStreetMap (no API key required)

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Not compatible with IE11

## Credits

- **Developer**: DPCN Course Project
- **Data Sources**: Hyderabad Metro GTFS, MMTS schedules, Open Data
- **Libraries**: React, Ant Design, Leaflet, Graphology
- **Algorithms**: Bidirectional Dijkstra, Greedy Set Cover approximation

## License

Educational use only. Not for commercial deployment.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production Ready (with minor ESLint warnings)
