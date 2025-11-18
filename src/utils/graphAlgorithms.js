/**
 * Graph Algorithms for Transport Network Analysis
 * Implements Dijkstra's algorithm and greedy recommendation logic
 */

import Graph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';

// Constants
const TRANSFER_PENALTY = 10000; // Large penalty for mode changes in transfer-minimizing mode
const UNREACHABLE = Infinity;

/**
 * Calculate Hyderabad Metro fare based on distance (in km)
 * OFFICIAL FARES from Hyderabad Metro Rail (HMRL) - Wikipedia verified
 * Source: https://en.wikipedia.org/wiki/Hyderabad_Metro (Announced 25 Nov 2017)
 * These are token/regular fares (NOT smart card which has 10% discount)
 * @param {Number} distanceKm - Distance in kilometers
 * @returns {Number} - Fare in rupees
 */
function calculateMetroFare(distanceKm) {
  // Official HMRL fare structure (token fare)
  if (distanceKm <= 2) return 10;
  if (distanceKm <= 4) return 20;
  if (distanceKm <= 6) return 30;
  if (distanceKm <= 9) return 40;
  if (distanceKm <= 12) return 50;
  if (distanceKm <= 15) return 60;
  if (distanceKm <= 18) return 70;
  if (distanceKm <= 21) return 80;
  if (distanceKm <= 24) return 90;
  return 100; // More than 24 km
}

/**
 * Custom Dijkstra for minimizing transfers
 * Uses (transfers, time) as composite key - minimizes transfers first, then time
 * @param {Graph} graph - Graph instance
 * @param {String} source - Source node ID
 * @param {String} target - Target node ID
 * @returns {Array|null} - Path as array of node IDs, or null if unreachable
 */
function dijkstraMinTransfers(graph, source, target) {
  if (!graph.hasNode(source) || !graph.hasNode(target)) {
    return null;
  }
  
  if (source === target) {
    return [source];
  }
  
  // Priority queue: {node, transfers, time, prevMode, path}
  const queue = [{ node: source, transfers: 0, time: 0, prevMode: null, path: [source] }];
  const visited = new Set();
  
  // Best known: node -> {transfers, time}
  const best = new Map();
  best.set(source, { transfers: 0, time: 0 });
  
  while (queue.length > 0) {
    // Sort by transfers first, then by time (lexicographic ordering)
    queue.sort((a, b) => {
      if (a.transfers !== b.transfers) return a.transfers - b.transfers;
      return a.time - b.time;
    });
    
    const current = queue.shift();
    
    if (current.node === target) {
      return current.path;
    }
    
    const stateKey = `${current.node}_${current.prevMode}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    
    // Explore neighbors
    graph.forEachNeighbor(current.node, (neighbor, attrs) => {
      const edge = graph.getEdgeAttributes(current.node, neighbor);
      const edgeMode = edge.transportMode || edge.mode;
      const edgeTime = edge.time || 0;
      
      // Calculate new transfers
      let newTransfers = current.transfers;
      if (current.prevMode !== null && current.prevMode !== edgeMode) {
        // Mode changed - this is a transfer
        newTransfers++;
      }
      
      const newTime = current.time + edgeTime;
      
      // Check if this path to neighbor is better
      const neighborKey = neighbor;
      const bestSoFar = best.get(neighborKey);
      
      let isBetter = false;
      if (!bestSoFar) {
        isBetter = true;
      } else if (newTransfers < bestSoFar.transfers) {
        isBetter = true;
      } else if (newTransfers === bestSoFar.transfers && newTime < bestSoFar.time) {
        isBetter = true;
      }
      
      if (isBetter) {
        best.set(neighborKey, { transfers: newTransfers, time: newTime });
        queue.push({
          node: neighbor,
          transfers: newTransfers,
          time: newTime,
          prevMode: edgeMode,
          path: [...current.path, neighbor]
        });
      }
    });
  }
  
  return null; // No path found
}

/**
 * Build graph from nodes and edges data
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @param {String} objective - 'time', 'cost', or 'transfers'
 * @param {Object} timeOfDayCoefficients - Object with {timeMultiplier, costMultiplier, capacityFactor, label}
 * @param {Object} routeContext - Optional {source, target} for Metro preference
 * @returns {Graph} - Graphology instance
 */
export function buildGraph(nodes, edges, objective = 'time', timeOfDayCoefficients = null, routeContext = null) {
  const graph = new Graph({ multi: false, type: 'undirected' });
  
  // Default coefficients if not provided
  const coefficients = timeOfDayCoefficients || {
    timeMultiplier: 1.0,
    costMultiplier: 1.0,
    capacityFactor: 1.0,
    label: 'Standard'
  };
  
  // Check if both source and destination are Metro stations (for Metro preference)
  const sourceIsMetro = routeContext?.source?.endsWith('_Metro') || false;
  const targetIsMetro = routeContext?.target?.endsWith('_Metro') || false;
  const preferMetro = sourceIsMetro && targetIsMetro;
  
  // Reset the debug flags on each graph build
  if (window._metroFareLogged) {
    delete window._metroFareLogged;
  }
  if (window._railTimeLogged) {
    delete window._railTimeLogged;
  }
  if (window._roadTimeLogged) {
    delete window._roadTimeLogged;
  }
  if (window._railCostLogged) {
    delete window._railCostLogged;
  }
  
  if (preferMetro) {
    console.log('🚇 METRO-TO-METRO ROUTING: Applying Metro preference for', routeContext.source, '→', routeContext.target);
  }
  
  console.log('Building graph with coefficients:', coefficients, 'objective:', objective);
  
  // Add nodes
  nodes.forEach(node => {
    graph.addNode(node.node_id, {
      ...node,
      label: node.name,
      lat: node.lat,
      lon: node.lon,
      layer: node.layer
    });
  });
  
  // Add edges with appropriate weights
  edges.forEach(edge => {
    const edgeKey = `${edge.from_id}_${edge.to_id}`;
    
    if (!graph.hasNode(edge.from_id) || !graph.hasNode(edge.to_id)) {
      return; // Skip if nodes don't exist
    }
    
    // Determine the transport mode from the edge
    const transportMode = edge.mode || edge.edge_type || 'unknown';
    
    // Calculate base cost - use Metro fare chart for Metro edges
    let baseCost;
    if (transportMode === 'metro') {
      // Use Hyderabad Metro official fare chart based on distance
      baseCost = calculateMetroFare(edge.distance_km);
      
      // Debug: Log first Metro edge to verify pricing
      if (!window._metroFareLogged) {
        console.log('💰 Metro Fare Calculation:', {
          edge: `${edge.from_id} → ${edge.to_id}`,
          distance: edge.distance_km.toFixed(2) + ' km',
          fare: '₹' + baseCost,
          oldCsvCost: '₹' + (edge.cost_rs || 0).toFixed(2)
        });
        window._metroFareLogged = true;
      }
    } else {
      // Use existing cost for other modes (bus, MMTS, etc.)
      baseCost = edge.cost_rs || 0;
    }
    
    // Apply time-of-day coefficients ONLY to road-based transport
    // Metro and MMTS have dedicated tracks - NOT affected by traffic!
    let adjustedTime;
    if (transportMode === 'metro' || transportMode === 'mmts') {
      // Dedicated track modes: NO traffic impact
      adjustedTime = edge.time_min; // Use base time always
      
      // Debug: Log first rail-based edge to verify NO traffic multiplier
      if (!window._railTimeLogged && (transportMode === 'metro' || transportMode === 'mmts')) {
        console.log(`🚆 RAIL TRANSPORT (${transportMode.toUpperCase()}): NO traffic impact`, {
          edge: `${edge.from_id} → ${edge.to_id}`,
          baseTime: edge.time_min.toFixed(2) + ' min',
          adjustedTime: adjustedTime.toFixed(2) + ' min',
          trafficMultiplier: coefficients.timeMultiplier,
          unchanged: '✅ Time NOT multiplied'
        });
        window._railTimeLogged = true;
      }
    } else {
      // Road-based modes (bus, auto): Apply traffic multiplier
      adjustedTime = edge.time_min * coefficients.timeMultiplier;
      
      // Debug: Log first road-based edge to verify traffic multiplier applied
      if (!window._roadTimeLogged && coefficients.timeMultiplier !== 1.0) {
        console.log(`🚗 ROAD TRANSPORT (${transportMode.toUpperCase()}): Traffic impact applied`, {
          edge: `${edge.from_id} → ${edge.to_id}`,
          baseTime: edge.time_min.toFixed(2) + ' min',
          adjustedTime: adjustedTime.toFixed(2) + ' min',
          trafficMultiplier: coefficients.timeMultiplier,
          increased: '⚠️ Time increased by ' + ((coefficients.timeMultiplier - 1) * 100).toFixed(0) + '%'
        });
        window._roadTimeLogged = true;
      }
    }
    
    // Apply cost multiplier ONLY to road-based transport
    // Metro and MMTS have fixed fares - NOT affected by time-of-day surge pricing!
    let adjustedCost;
    if (transportMode === 'metro' || transportMode === 'mmts') {
      // Rail-based modes: NO surge pricing
      adjustedCost = baseCost; // Use base cost always
      
      // Debug: Log first rail cost to verify NO cost multiplier
      if (!window._railCostLogged && coefficients.costMultiplier !== 1.0) {
        console.log(`💰 RAIL COST (${transportMode.toUpperCase()}): NO surge pricing`, {
          edge: `${edge.from_id} → ${edge.to_id}`,
          baseCost: '₹' + baseCost,
          adjustedCost: '₹' + adjustedCost,
          costMultiplier: coefficients.costMultiplier,
          unchanged: '✅ Cost NOT multiplied'
        });
        window._railCostLogged = true;
      }
    } else {
      // Road-based modes (bus, auto): Apply surge pricing
      adjustedCost = baseCost * coefficients.costMultiplier;
    }
    
    // METRO PREFERENCE: For Metro-to-Metro routing, make non-Metro options less attractive
    if (preferMetro && transportMode !== 'metro' && edge.intra_or_inter !== 'inter') {
      // Apply penalty to non-Metro intra-modal edges (buses, MMTS)
      // Don't penalize transfer edges as they're necessary for mode changes
      adjustedCost *= 1.4; // Make non-Metro 40% more expensive for cost optimization
    }
    
    let weight;
    if (objective === 'time') {
      // Use adjusted time with traffic multiplier (rail=base, road=adjusted)
      weight = adjustedTime;
    } else if (objective === 'cost') {
      // Use adjusted cost with surge pricing (rail=base, road=adjusted)
      weight = adjustedCost;
    } else if (objective === 'transfers') {
      // For transfer minimization: Use ORIGINAL TIME (no traffic impact)
      // This ensures transfer minimization finds the actual shortest path
      const baseWeight = edge.time_min * 0.01;
      const isInterModal = edge.intra_or_inter === 'inter';
      weight = baseWeight + (isInterModal ? TRANSFER_PENALTY : 0);
    }
    
    // Debug: Log first metro edge to show new fare calculation
    if (transportMode === 'metro' && !graph.hasEdge(edge.from_id, edge.to_id)) {
      const isFirstMetro = !graph.edges().some(e => {
        const attrs = graph.getEdgeAttributes(e);
        return attrs.mode === 'metro';
      });
      if (isFirstMetro) {
        console.log(`� METRO FARE CALCULATION (${edge.from_id} → ${edge.to_id}):`, {
          distanceKm: edge.distance_km.toFixed(2),
          oldCost: edge.cost_rs,
          newMetroFare: baseCost,
          adjustedCost: adjustedCost.toFixed(2),
          costMultiplier: coefficients.costMultiplier
        });
      }
    }
    
    try {
      if (!graph.hasEdge(edge.from_id, edge.to_id)) {
        graph.addEdge(edge.from_id, edge.to_id, {
          ...edge,
          weight,
          transportMode, // Store the actual transport mode
          mode: transportMode,
          distance: edge.distance_km,
          time: adjustedTime,          // Store adjusted time
          cost: adjustedCost,          // Store adjusted cost (with Metro fare chart)
          baseTime: edge.time_min,     // Store original time
          baseCost: baseCost,          // Store calculated base cost (Metro fare or original)
          originalCost: edge.cost_rs,  // Store original CSV cost for reference
          capacityFactor: coefficients.capacityFactor,
          isInterModal: edge.intra_or_inter === 'inter'
        });
      }
    } catch (e) {
      console.warn('Edge addition failed:', e);
    }
  });
  
  return graph;
}

/**
 * Compute shortest path with transfer counting
 * @param {Graph} graph - Graph instance
 * @param {String} source - Source node ID
 * @param {String} target - Target node ID
 * @param {String} objective - 'time', 'cost', or 'transfers'
 * @returns {Object} - {path, distance, transfers, time, cost}
 */
export function computeShortestPath(graph, source, target, objective = 'time') {
  if (!graph.hasNode(source) || !graph.hasNode(target)) {
    return { path: null, distance: UNREACHABLE, transfers: UNREACHABLE, time: UNREACHABLE, cost: UNREACHABLE };
  }
  
  if (source === target) {
    return { path: [source], distance: 0, transfers: 0, time: 0, cost: 0 };
  }
  
  try {
    let path;
    
    // Use specialized algorithm for transfer minimization
    if (objective === 'transfers') {
      path = dijkstraMinTransfers(graph, source, target);
    } else {
      // Use standard bidirectional Dijkstra for time/cost optimization
      path = bidirectional(graph, source, target, 'weight');
    }
    
    console.log(`📍 PATH FOUND for objective="${objective}":`, path ? `${path.length} nodes` : 'NULL');
    
    if (!path) {
      return { path: null, distance: UNREACHABLE, transfers: UNREACHABLE, time: UNREACHABLE, cost: UNREACHABLE };
    }
    
    // Calculate metrics along the path
    let totalTime = 0;
    let totalCost = 0;
    let totalDistance = 0;
    let transfers = 0;
    let prevMode = null;
    let pathWeightSum = 0; // Track total weight used
    const pathSegments = []; // Store detailed segment information
    
    // Debug: Track Metro costs separately
    let metroSegments = 0;
    let metroTotalCost = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.getEdgeAttributes(path[i], path[i + 1]);
      const fromNode = graph.getNodeAttributes(path[i]);
      const toNode = graph.getNodeAttributes(path[i + 1]);
      const segmentTime = edge.time || 0;
      const segmentCost = edge.cost || 0;
      const segmentMode = edge.transportMode || edge.mode || 'unknown';
      
      totalTime += segmentTime;
      totalCost += segmentCost;
      totalDistance += edge.distance || 0;
      pathWeightSum += edge.weight || 0;
      
      // Debug tracking
      if (segmentMode === 'metro') {
        metroSegments++;
        metroTotalCost += segmentCost;
      }
      
      // Store segment details
      pathSegments.push({
        from: fromNode.name || path[i],
        to: toNode.name || path[i + 1],
        fromId: path[i],
        toId: path[i + 1],
        mode: segmentMode,
        time: segmentTime,
        cost: segmentCost,
        distance: edge.distance || 0
      });
      
      // Debug: Log first edge to verify coefficients are applied
      if (i === 0 && path.length > 1) {
        console.log('Sample edge:', {
          from: path[i],
          to: path[i+1],
          time: edge.time,
          cost: edge.cost,
          baseTime: edge.baseTime,
          baseCost: edge.baseCost
        });
      }
      
      // Count transfers: mode changes between consecutive edges
      const currentMode = edge.transportMode || edge.mode;
      
      if (prevMode !== null && prevMode !== currentMode) {
        // Mode changed - this is a transfer
        transfers++;
      }
      prevMode = currentMode;
    }
    
    console.log(`✅ COMPUTED METRICS for ${objective}:`, {
      nodes: path.length,
      time: totalTime.toFixed(2),
      cost: totalCost.toFixed(2),
      metroSegments,
      metroCost: metroTotalCost.toFixed(2),
      avgMetroCostPerSegment: metroSegments > 0 ? (metroTotalCost / metroSegments).toFixed(2) : 'N/A',
      transfers,
      totalWeight: pathWeightSum.toFixed(2)
    });
    
    return {
      path,
      pathSegments, // Detailed segment-by-segment breakdown
      distance: totalDistance,
      transfers,
      time: totalTime,
      cost: totalCost
    };
  } catch (e) {
    console.error('Shortest path computation failed:', e);
    return { path: null, pathSegments: [], distance: UNREACHABLE, transfers: UNREACHABLE, time: UNREACHABLE, cost: UNREACHABLE };
  }
}

/**
 * Apply failure to graph
 * @param {Graph} graph - Original graph
 * @param {String} failureType - 'node', 'edge', or 'layer'
 * @param {Array} failureTargets - Array of node IDs, edge IDs, or layer names
 * @returns {Graph} - New graph with failures applied
 */
export function applyFailure(graph, failureType, failureTargets = []) {
  const failedGraph = graph.copy();
  
  if (failureTargets.length === 0) {
    return failedGraph; // No failure
  }
  
  if (failureType === 'node') {
    failureTargets.forEach(nodeId => {
      if (failedGraph.hasNode(nodeId)) {
        failedGraph.dropNode(nodeId);
      }
    });
  } else if (failureType === 'edge') {
    failureTargets.forEach(edgeSpec => {
      const [from, to] = edgeSpec.split('_');
      if (failedGraph.hasEdge(from, to)) {
        failedGraph.dropEdge(from, to);
      }
    });
  } else if (failureType === 'layer') {
    const nodesToRemove = [];
    failedGraph.forEachNode((node, attrs) => {
      if (failureTargets.includes(attrs.layer)) {
        nodesToRemove.push(node);
      }
    });
    nodesToRemove.forEach(node => failedGraph.dropNode(node));
  }
  
  return failedGraph;
}

/**
 * Compute baseline or scenario metrics for OD pairs
 * @param {Graph} graph - Graph instance
 * @param {Array} odPairs - Array of {source, target} objects
 * @param {String} objective - 'time', 'cost', or 'transfers'
 * @returns {Object} - Aggregated metrics and detailed results
 */
export function computeMetrics(graph, odPairs, objective = 'time') {
  console.log(`🚀 COMPUTE METRICS CALLED for objective="${objective}" with ${odPairs.length} OD pairs`);
  
  const results = [];
  let totalTime = 0;
  let totalCost = 0;
  let totalTransfers = 0;
  let disconnected = 0;
  let validPairs = 0;
  
  odPairs.forEach(({ source, target, sourceName, targetName }, index) => {
    const result = computeShortestPath(graph, source, target, objective);
    
    // Log first OD pair for debugging
    if (index === 0) {
      console.log(`🎯 FIRST OD PAIR (${sourceName} → ${targetName}) for objective="${objective}":`, {
        time: result.time,
        cost: result.cost,
        transfers: result.transfers,
        nodes: result.path ? result.path.length : 0
      });
    }
    
    if (result.time === UNREACHABLE) {
      disconnected++;
      results.push({
        source,
        target,
        sourceName: sourceName || source,
        targetName: targetName || target,
        ...result,
        reachable: false
      });
    } else {
      totalTime += result.time;
      totalCost += result.cost;
      totalTransfers += result.transfers;
      validPairs++;
      results.push({
        source,
        target,
        sourceName: sourceName || source,
        targetName: targetName || target,
        ...result,
        reachable: true
      });
    }
  });
  
  const finalMetrics = {
    avgTime: validPairs > 0 ? totalTime / validPairs : 0,
    avgCost: validPairs > 0 ? totalCost / validPairs : 0,
    avgTransfers: validPairs > 0 ? totalTransfers / validPairs : 0,
    disconnected,
    totalPairs: odPairs.length,
    validPairs,
    results
  };
  
  console.log(`📊 FINAL METRICS for objective="${objective}":`, {
    avgTime: finalMetrics.avgTime.toFixed(2),
    avgCost: finalMetrics.avgCost.toFixed(2),
    avgTransfers: finalMetrics.avgTransfers.toFixed(2),
    validPairs
  });
  
  return finalMetrics;
}

/**
 * Calculate Euclidean distance between two points
 */
function euclideanDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generate candidate links for greedy recommendation
 * @param {Array} nodes - All nodes
 * @param {Graph} originalGraph - Original graph before failure
 * @param {Graph} failedGraph - Graph after failure
 * @param {Array} scenarioResults - Results from scenario computation
 * @returns {Array} - Array of candidate link objects
 */
export function generateCandidates(nodes, originalGraph, failedGraph, scenarioResults) {
  const candidates = [];
  const candidateSet = new Set();
  
  // Helper to add candidate without duplicates
  const addCandidate = (from, to, type, priority = 0) => {
    const key = `${from}_${to}`;
    const reverseKey = `${to}_${from}`;
    
    if (candidateSet.has(key) || candidateSet.has(reverseKey)) {
      return;
    }
    
    if (failedGraph.hasEdge(from, to) || originalGraph.hasEdge(from, to)) {
      return; // Already connected
    }
    
    const fromNode = nodes.find(n => n.node_id === from);
    const toNode = nodes.find(n => n.node_id === to);
    
    if (!fromNode || !toNode) return;
    
    const distance = euclideanDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);
    
    candidates.push({
      from,
      to,
      fromName: fromNode.name,
      toName: toNode.name,
      type,
      distance,
      priority
    });
    
    candidateSet.add(key);
  };
  
  // 1. Primary hub neighbors (bus hubs within 2-6 km)
  const busHubs = nodes.filter(n => n.type === 'hub' && n.layer === 'bus');
  for (let i = 0; i < busHubs.length; i++) {
    for (let j = i + 1; j < busHubs.length; j++) {
      const dist = euclideanDistance(
        busHubs[i].lat, busHubs[i].lon,
        busHubs[j].lat, busHubs[j].lon
      );
      if (dist >= 2 && dist <= 6) {
        addCandidate(busHubs[i].node_id, busHubs[j].node_id, 'hub_neighbor', 10);
      }
    }
  }
  
  // 2. Cross-rail candidates (metro ↔ mmts within 2-4 km)
  const metroStations = nodes.filter(n => n.layer === 'metro');
  const mmtsStations = nodes.filter(n => n.layer === 'mmts');
  
  metroStations.forEach(metro => {
    mmtsStations.forEach(mmts => {
      const dist = euclideanDistance(metro.lat, metro.lon, mmts.lat, mmts.lon);
      if (dist >= 0.5 && dist <= 4) {
        addCandidate(metro.node_id, mmts.node_id, 'cross_rail', 8);
      }
    });
  });
  
  // 3. Top OD-driven pairs (based on worst degradation)
  const topAffected = scenarioResults
    .filter(r => r.reachable)
    .sort((a, b) => (b.time - a.time) - (a.time - 0))
    .slice(0, 5);
  
  topAffected.forEach(od => {
    if (od.path && od.path.length > 2) {
      // Try to link origin to intermediate nodes
      const midPoint = Math.floor(od.path.length / 2);
      if (od.path[0] && od.path[midPoint]) {
        addCandidate(od.path[0], od.path[midPoint], 'od_driven', 7);
      }
    }
  });
  
  // 4. Express hub connections (major hubs across regions)
  const majorHubs = nodes.filter(n => 
    (n.type === 'hub' || n.type === 'station') && 
    (n.layer === 'bus' || n.layer === 'metro')
  );
  
  for (let i = 0; i < majorHubs.length && candidates.length < 40; i++) {
    for (let j = i + 1; j < majorHubs.length && candidates.length < 40; j++) {
      if (majorHubs[i].region !== majorHubs[j].region) {
        const dist = euclideanDistance(
          majorHubs[i].lat, majorHubs[i].lon,
          majorHubs[j].lat, majorHubs[j].lon
        );
        if (dist >= 3 && dist <= 15) {
          addCandidate(majorHubs[i].node_id, majorHubs[j].node_id, 'express_hub', 6);
        }
      }
    }
  }
  
  // Sort by priority and limit to 30
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 30);
}

/**
 * Greedy link recommendation algorithm
 * @param {Graph} failedGraph - Graph after failure
 * @param {Array} candidates - Candidate links
 * @param {Array} odPairs - OD pairs for evaluation
 * @param {Number} budget - Maximum number of links to add
 * @param {String} objective - 'time', 'cost', or 'transfers'
 * @param {Function} progressCallback - Called with progress updates
 * @param {Object} timeOfDayCoefficients - Time of day coefficients for new edges
 * @returns {Array} - Selected links with improvements
 */
export function greedyRecommendation(
  failedGraph,
  candidates,
  odPairs,
  budget,
  objective = 'time',
  progressCallback = null,
  timeOfDayCoefficients = null
) {
  const selectedLinks = [];
  const workingGraph = failedGraph.copy();
  
  // Default coefficients if not provided
  const coefficients = timeOfDayCoefficients || {
    timeMultiplier: 1.0,
    costMultiplier: 1.0,
    capacityFactor: 1.0,
    label: 'Standard'
  };
  
  // Calculate baseline metrics on failed graph
  const baselineMetrics = computeMetrics(workingGraph, odPairs, objective);
  const baselineValue = objective === 'time' ? baselineMetrics.avgTime :
                       objective === 'cost' ? baselineMetrics.avgCost :
                       baselineMetrics.avgTransfers;
  
  let remainingCandidates = [...candidates];
  
  for (let iteration = 0; iteration < budget && remainingCandidates.length > 0; iteration++) {
    let bestCandidate = null;
    let bestImprovement = 0;
    let bestMetrics = null;
    
    // Evaluate each remaining candidate
    for (let i = 0; i < remainingCandidates.length; i++) {
      const candidate = remainingCandidates[i];
      
      if (progressCallback) {
        progressCallback({
          iteration,
          candidateIndex: i,
          totalCandidates: remainingCandidates.length,
          budget
        });
      }
      
      // Temporarily add candidate edge
      const testGraph = workingGraph.copy();
      
      // Calculate edge properties based on type and apply time-of-day coefficients
      let time, cost, transportMode;
      if (candidate.type === 'hub_neighbor' || candidate.type === 'express_hub') {
        // Express bus link
        const expressSpeed = 35; // km/h
        const baseTime = (candidate.distance / expressSpeed) * 60; // minutes
        const baseCost = candidate.distance * 3; // ₹3 per km
        time = baseTime * coefficients.timeMultiplier;
        cost = baseCost * coefficients.costMultiplier;
        transportMode = 'bus';
      } else if (candidate.type === 'cross_rail') {
        // Walk/transfer link
        const walkSpeed = 5; // km/h
        const baseTime = (candidate.distance / walkSpeed) * 60; // minutes
        time = baseTime * coefficients.timeMultiplier;
        cost = 0; // Walking is free
        transportMode = 'walking';
      } else {
        // Default bus link
        const baseTime = (candidate.distance / 25) * 60; // 25 km/h
        const baseCost = candidate.distance * 2.5;
        time = baseTime * coefficients.timeMultiplier;
        cost = baseCost * coefficients.costMultiplier;
        transportMode = 'bus';
      }
      
      try {
        testGraph.addEdge(candidate.from, candidate.to, {
          weight: objective === 'time' ? time : objective === 'cost' ? cost : time * 0.001,
          mode: transportMode,
          transportMode: transportMode,
          time,
          cost,
          distance: candidate.distance,
          edge_type: 'inter',
          intra_or_inter: 'inter',
          reason: 'candidate_' + candidate.type
        });
        
        // Compute metrics with this candidate
        const testMetrics = computeMetrics(testGraph, odPairs, objective);
        const testValue = objective === 'time' ? testMetrics.avgTime :
                         objective === 'cost' ? testMetrics.avgCost :
                         testMetrics.avgTransfers;
        
        const improvement = baselineValue - testValue;
        
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestCandidate = { ...candidate, time, cost, transportMode };
          bestMetrics = testMetrics;
        }
      } catch (e) {
        console.warn('Failed to evaluate candidate:', e);
      }
    }
    
    // If no improvement found, stop
    if (bestImprovement <= 0 || !bestCandidate) {
      break;
    }
    
    // Add best candidate permanently
    try {
      workingGraph.addEdge(bestCandidate.from, bestCandidate.to, {
        weight: objective === 'time' ? bestCandidate.time : 
                objective === 'cost' ? bestCandidate.cost : 
                bestCandidate.time * 0.001,
        mode: bestCandidate.transportMode,
        transportMode: bestCandidate.transportMode,
        time: bestCandidate.time,
        cost: bestCandidate.cost,
        distance: bestCandidate.distance,
        edge_type: 'inter',
        intra_or_inter: 'inter',
        reason: 'recommended_' + bestCandidate.type
      });
      
      selectedLinks.push({
        ...bestCandidate,
        improvement: bestImprovement,
        metrics: bestMetrics
      });
      
      // Remove from remaining candidates
      remainingCandidates = remainingCandidates.filter(c => 
        !(c.from === bestCandidate.from && c.to === bestCandidate.to)
      );
    } catch (e) {
      console.error('Failed to add selected candidate:', e);
    }
  }
  
  return {
    selectedLinks,
    finalGraph: workingGraph,
    finalMetrics: computeMetrics(workingGraph, odPairs, objective)
  };
}

/**
 * Generate default OD sample from nodes
 * @param {Array} nodes - All nodes
 * @param {Number} sampleSize - Number of OD pairs to generate
 * @returns {Array} - Array of {source, target, sourceName, targetName} objects
 */
export function generateODSample(nodes, sampleSize = 40) {
  const majorNodes = nodes.filter(n => 
    n.type === 'station' || n.type === 'hub' || 
    (n.layer === 'metro' && n.name)
  );
  
  const odPairs = [];
  const usedPairs = new Set();
  
  while (odPairs.length < sampleSize && odPairs.length < (majorNodes.length * (majorNodes.length - 1) / 2)) {
    const i = Math.floor(Math.random() * majorNodes.length);
    const j = Math.floor(Math.random() * majorNodes.length);
    
    if (i !== j) {
      const key = `${majorNodes[i].node_id}_${majorNodes[j].node_id}`;
      const reverseKey = `${majorNodes[j].node_id}_${majorNodes[i].node_id}`;
      
      if (!usedPairs.has(key) && !usedPairs.has(reverseKey)) {
        odPairs.push({
          source: majorNodes[i].node_id,
          target: majorNodes[j].node_id,
          sourceName: majorNodes[i].name,
          targetName: majorNodes[j].name
        });
        usedPairs.add(key);
      }
    }
  }
  
  return odPairs;
}
