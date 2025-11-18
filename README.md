# Hyderabad Transport Network Resilience & Greedy Recommender

A frontend-only React application for simulating transport network failures and automatically recommending new links using a greedy algorithm.

## Features

- **Failure Simulation**: Simulate node failures, edge failures, or entire layer outages
- **Impact Analysis**: Compute changes in travel time, cost, transfers, and connectivity
- **Automatic Recommendations**: Greedy algorithm suggests optimal new links based on budget
- **Interactive Maps**: Visualize network before, after failure, and after fixes using Leaflet
- **OD Pair Analysis**: Identify most affected origin-destination pairs
- **Real-time Progress**: Track evaluation progress during greedy selection

## Installation

```bash
npm install
```

## Running the App

```bash
npm start
```

The app will open at `http://localhost:3000`.

## Usage

### 1. Select Scenario Parameters

- **Source/Destination**: Choose specific OD pair or "All" for sample analysis
- **Failure Type**: Choose node down, edge down, or layer down
- **Failure Targets**: Select which nodes/edges/layers to remove
- **Objective**: Optimize for fastest time, least cost, or fewest transfers
- **Time of Day**: Apply peak-hour congestion multipliers
- **Budget**: Number of new links to add (0-20)

### 2. Run Scenario

Click "Run Scenario" to:
1. Build network graph with specified objectives
2. Compute baseline metrics
3. Apply failure and compute degraded metrics
4. Automatically run greedy recommender if budget > 0
5. Display results, maps, and recommended links

### 3. View Results

- **Metrics Cards**: Before/After/Change statistics
- **Maps**: Interactive Leaflet maps showing network state
- **Top Affected Pairs**: Table of OD pairs with highest delays
- **Recommended Links**: Details of suggested new connections

## Algorithm Details

### Greedy Link Recommendation

1. **Candidate Generation** (4 strategies):
   - Hub neighbors: Bus hubs 2-6km apart
   - Cross-rail: Metro ↔ MMTS stations 0.5-4km apart
   - OD-driven: Top 5 most degraded OD pairs
   - Express hubs: Major hubs 3-15km across regions

2. **Greedy Selection**:
   - Evaluate each candidate by temporarily adding to graph
   - Compute improvement in average travel time/cost/transfers
   - Select candidate with maximum improvement
   - Add permanently and repeat until budget exhausted

3. **Termination**: Stops when budget reached or no improvement found

## Data Requirements

Place these files in `public/`:
- `nodes.csv`: Node attributes (node_id, lat, lon, layer, name, region)
- `edges.csv`: Edge connections (from_id, to_id, layer, type, distance_km, time_min, cost_rs)

## Technology Stack

- React 18.2.0
- Ant Design 5.11.5 (UI components)
- Leaflet 1.9.4 (Interactive maps)
- Plotly.js 2.27.0 (Charts)
- Graphology 0.25.4 (Graph algorithms)

## Example Scenarios

1. **Ameerpet Metro Station Down**:
   - Failure Type: Node Down
   - Target: AME (Red+Blue interchange)
   - Expected: Significant impact on Red/Blue lines, recommendations for alternative metro connections

2. **Metro Layer Outage**:
   - Failure Type: Layer Down
   - Target: metro
   - Expected: Massive delays, recommendations for express bus links

3. **Secunderabad Junction Down**:
   - Failure Type: Node Down
   - Target: SEC (major interchange)
   - Expected: North-South connectivity disruption

## Performance Notes

- Greedy algorithm can take 10-30 seconds for budget > 5
- Progress updates shown during evaluation
- Consider using smaller budgets for faster results
- Sample OD pairs (40 by default) used for "All" mode

## License

Educational project for DPCN course.
