# Recommended Links Explanation

## What Are Recommended Links?

Recommended links are **new connections** (edges) that the system suggests adding to the transport network to compensate for failed nodes or degraded performance.

## How Are They Generated?

### Step 1: Generate Candidates
The `generateCandidates()` function creates potential new links based on:

1. **Hub Neighbors** (Priority 10)
   - Connects nearby bus hubs (2-6 km apart)
   - Creates express bus routes between major hubs
   - Example: Direct bus from Secunderabad to Kukatpally

2. **Cross-Rail** (Priority 8)
   - Links metro and MMTS stations (0.5-4 km apart)
   - Enables transfers between rail systems
   - Example: Walking/shuttle link from Paradise Metro to Begumpet MMTS

3. **OD-Driven** (Priority 7)
   - Based on most affected origin-destination pairs
   - Adds shortcuts for routes with worst degradation
   - Example: Direct link for passengers facing longest detours

4. **Express Hub** (Priority 6)
   - Connects major hubs across different regions (3-15 km)
   - Long-distance express routes
   - Example: Express bus from Dilsukhnagar to Gachibowli

### Step 2: Greedy Selection
The `greedyRecommendation()` function:

1. **Evaluates each candidate** by temporarily adding it to the failed graph
2. **Calculates improvement** in average travel time/cost
3. **Selects the best** candidate that gives maximum improvement
4. **Adds it permanently** and repeats for next iteration
5. **Stops** when budget is reached or no more improvements found

## Link Properties

Each recommended link contains:

```javascript
{
  from: "node_123",              // Origin node ID
  to: "node_456",                // Destination node ID
  fromName: "Secunderabad Hub",  // Origin name
  toName: "Kukatpally Hub",      // Destination name
  type: "hub_neighbor",          // Link type
  distance: 12.5,                // Distance in km
  time: 25.3,                    // Estimated travel time (minutes)
  cost: 37.5,                    // Estimated cost (₹)
  transportMode: "bus",          // Mode: bus/walking
  improvement: 8.2,              // Average time saved (minutes)
  metrics: {                     // Network metrics after adding this link
    avgTime: 67.3,
    avgCost: 42.1,
    disconnected: 2
  }
}
```

## What Gets Displayed?

For each link, the UI shows:

1. **Link Number** - Sequential order (Link 1, Link 2, etc.)
2. **Link Type** - Category of connection:
   - `hub_neighbor` → "hub neighbor"
   - `cross_rail` → "cross rail" 
   - `od_driven` → "od driven"
   - `express_hub` → "express hub"
3. **Connection** - From station ↔ To station
4. **Distance** - Kilometers between nodes
5. **Est. Time** - Calculated travel time with time-of-day multipliers
6. **Improvement** - How much average time is saved across all OD pairs
7. **Est. Cost** - Construction cost estimate (₹50,000 per km)

## Summary Statistics

At the bottom, we show:
- **Total Links**: Number of recommendations
- **Total Distance**: Sum of all link distances
- **Avg. Improvement**: Mean time saved per link

## Example Scenario

**Before Failure:**
- Average travel time: 65 minutes
- All 40 OD pairs connected

**After Failure (Node Down):**
- Average travel time: 78 minutes (+20%)
- 3 OD pairs disconnected

**With Budget = 3 Recommendations:**

**Link 1: Hub Neighbor**
- Secunderabad Hub ↔ Ameerpet Hub
- 8.2 km, 18.5 min, ₹24.60
- Improvement: -5.2 min avg
- Cost: ₹410k

**Link 2: Cross Rail**  
- Paradise Metro ↔ Begumpet MMTS
- 1.8 km, 21.6 min (walk), ₹0
- Improvement: -3.1 min avg
- Cost: ₹90k

**Link 3: Express Hub**
- Dilsukhnagar Hub ↔ Gachibowli Hub  
- 15.3 km, 32.7 min, ₹45.90
- Improvement: -2.8 min avg
- Cost: ₹765k

**After Recommendations:**
- Average travel time: 66.9 minutes (from 78)
- Recovery: 85% of lost performance
- Total cost: ₹1,265k

## Why These Specific Links?

The algorithm chooses links that:
1. ✅ **Maximize improvement** in travel time/cost
2. ✅ **Connect strategic points** (hubs, stations)
3. ✅ **Are feasible** (reasonable distance)
4. ✅ **Don't duplicate** existing connections
5. ✅ **Respect budget** (max number of links)

## Time-of-Day Impact

Link properties (time/cost) are adjusted based on:
- **Morning/Evening Peak**: +45-65% time, +25-35% cost
- **Afternoon**: Standard multipliers
- **Night**: -15% time, +40% cost (surge pricing)

This makes recommendations realistic for Hyderabad traffic patterns.

## Common Questions

**Q: Why only 3 links with budget=3?**  
A: The algorithm adds exactly the number specified by budget, unless it can't find any more links that provide improvement.

**Q: Can we add more than recommended?**  
A: Increase the budget parameter to get more recommendations.

**Q: Why does improvement decrease for later links?**  
A: The best links are added first. Each subsequent link provides diminishing returns as the network is already partially recovered.

**Q: What if no links are shown?**  
A: Either budget=0, or the scenario didn't find any candidates that improve the network.
