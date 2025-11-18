import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Select,
  Radio,
  Button,
  Card,
  Statistic,
  Row,
  Col,
  Tabs,
  Table,
  Progress,
  Tooltip,
  message,
  InputNumber,
  Tag,
  Space,
  Alert,
  Spin
} from 'antd';
import {
  PlayCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import NetworkMap from './components/NetworkMap';
import {
  buildGraph,
  applyFailure,
  computeMetrics,
  generateCandidates,
  greedyRecommendation,
  generateODSample
} from './utils/graphAlgorithms';
import './App.css';

const { Option } = Select;
const { TabPane } = Tabs;

// Load network data
const loadNetworkData = async () => {
  try {
    const nodesResponse = await fetch('/nodes.csv');
    const edgesResponse = await fetch('/edges.csv');
    
    const nodesText = await nodesResponse.text();
    const edgesText = await edgesResponse.text();
    
    // Parse CSV
    const parseCSV = (text) => {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',');
      return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i] ? values[i].trim() : '';
        });
        return obj;
      });
    };
    
    const nodes = parseCSV(nodesText);
    const edges = parseCSV(edgesText);
    
    // Convert numeric fields
    nodes.forEach(n => {
      n.lat = parseFloat(n.lat);
      n.lon = parseFloat(n.lon);
      n.Df = parseFloat(n.Df || 1);
      n.Hf = parseFloat(n.Hf || 1);
      n.Cf = parseFloat(n.Cf || 1);
    });
    
    edges.forEach(e => {
      e.distance_km = parseFloat(e.distance_km || 0);
      e.time_min = parseFloat(e.time_min || 0);
      e.cost_rs = parseFloat(e.cost_rs || 0);
    });
    
    return { nodes, edges };
  } catch (error) {
    console.error('Error loading network data:', error);
    return null;
  }
};

function App() {
  // State management
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  
  // Control states
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [failureHubs, setFailureHubs] = useState([]);
  const [failureType, setFailureType] = useState('none');
  const [selectedEdges, setSelectedEdges] = useState([]);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [objective, setObjective] = useState('time');
  const [timeOfDay, setTimeOfDay] = useState('afternoon');
  const [budget, setBudget] = useState(2);
  const [customBudget, setCustomBudget] = useState(2);
  
  // Results states
  const [baselineMetrics, setBaselineMetrics] = useState(null);
  const [scenarioMetrics, setScenarioMetrics] = useState(null);
  const [recommendedLinks, setRecommendedLinks] = useState([]);
  const [finalMetrics, setFinalMetrics] = useState(null);
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [topAffectedPairs, setTopAffectedPairs] = useState([]);
  
  // Graph states
  const [originalGraph, setOriginalGraph] = useState(null);
  const [failedGraph, setFailedGraph] = useState(null);
  const [fixedGraph, setFixedGraph] = useState(null);
  
  // Debug: Log recommendedLinks changes
  useEffect(() => {
    console.log('🔗 recommendedLinks updated:', recommendedLinks);
    console.log('🔗 recommendedLinks length:', recommendedLinks?.length);
  }, [recommendedLinks]);
  
  // Helper function to add directional suffix to bus feeder stations
  const getDisplayName = (node) => {
    if (!node.name || !node.node_id.includes('_feeder_')) {
      return node.name;
    }
    
    // Extract suffix number from node_id (e.g., Bus_feeder_MYP_Metro_0 -> 0)
    const match = node.node_id.match(/_(\d+)$/);
    if (!match) return node.name;
    
    const suffixNum = parseInt(match[1]);
    const directions = ['North', 'East', 'South', 'West'];
    const direction = directions[suffixNum % 4];
    
    // Replace "Bus near" with direction
    return node.name.replace('Bus near', direction);
  };
  
  // OD pairs
  const odPairsRef = useRef([]);
  
  // Load data on mount
  useEffect(() => {
    loadNetworkData().then(data => {
      if (data) {
        setNodes(data.nodes);
        setEdges(data.edges);
        
        // Generate default OD sample
        odPairsRef.current = generateODSample(data.nodes, 40);
        
        setLoading(false);
        message.success('Network data loaded successfully!');
      } else {
        message.error('Failed to load network data');
      }
    });
  }, []);
  
  // Calculate time of day multiplier
  // Get time-of-day coefficients based on realistic traffic patterns in Hyderabad
  const getTimeOfDayMultiplier = useCallback(() => {
    switch (timeOfDay) {
      case 'morning':
        // Morning Peak (7 AM - 10 AM): Heavy office/school traffic
        return {
          timeMultiplier: 1.45,     // 45% increase in travel time due to traffic
          costMultiplier: 1.25,      // 25% surge in auto/taxi fares
          capacityFactor: 0.75,      // 25% reduced effective capacity (crowded)
          label: 'Morning Peak (7-10 AM)'
        };
      
      case 'afternoon':
        // Afternoon (12 PM - 4 PM): Moderate traffic, lunch hours
        return {
          timeMultiplier: 1.15,      // 15% increase in travel time
          costMultiplier: 1.05,      // 5% slight surge in fares
          capacityFactor: 0.90,      // 10% reduced capacity
          label: 'Afternoon (12-4 PM)'
        };
      
      case 'evening':
        // Evening Peak (5 PM - 9 PM): Heaviest traffic, return commute
        return {
          timeMultiplier: 1.65,      // 65% increase - worst traffic period
          costMultiplier: 1.35,      // 35% surge pricing at peak
          capacityFactor: 0.70,      // 30% reduced capacity (very crowded)
          label: 'Evening Peak (5-9 PM)'
        };
      
      case 'night':
        // Night (10 PM - 6 AM): Light traffic, limited services
        return {
          timeMultiplier: 0.85,      // 15% faster travel time
          costMultiplier: 1.40,      // 40% surge for night services
          capacityFactor: 1.0,       // Full capacity (empty)
          label: 'Night (10 PM-6 AM)'
        };
      
      default:
        return {
          timeMultiplier: 1.0,
          costMultiplier: 1.0,
          capacityFactor: 1.0,
          label: 'Standard'
        };
    }
  }, [timeOfDay]);
  
  // Run scenario
  const runScenario = useCallback(async () => {
    if (nodes.length === 0 || edges.length === 0) {
      message.error('Network data not loaded');
      return;
    }
    
    setRunning(true);
    setProgress({ message: 'Building network graph...', percent: 10 });
    
    try {
      // Build original graph
      const todMultiplier = getTimeOfDayMultiplier();
      console.log('Time of Day Coefficients:', todMultiplier);
      
      // Prepare route context for Metro preference
      const routeContext = (source && destination && source !== 'All' && destination !== 'All') 
        ? { source, target: destination }
        : null;
      
      const graph = buildGraph(nodes, edges, objective, todMultiplier, routeContext);
      setOriginalGraph(graph);
      
      // Determine OD pairs
      let odPairs = odPairsRef.current;
      if (source && destination && source !== 'All' && destination !== 'All') {
        odPairs = [{
          source,
          target: destination,
          sourceName: nodes.find(n => n.node_id === source)?.name || source,
          targetName: nodes.find(n => n.node_id === destination)?.name || destination
        }];
      }
      
      // Compute baseline
      setProgress({ message: 'Computing baseline metrics...', percent: 20 });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const baseline = computeMetrics(graph, odPairs, objective);
      setBaselineMetrics(baseline);
      
      // Apply failure
      setProgress({ message: 'Applying failure scenario...', percent: 35 });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let failed;
      if (failureType === 'none') {
        // No failure - use original graph
        failed = graph;
      } else {
        let failureTargets = [];
        if (failureType === 'node') {
          failureTargets = failureHubs;
        } else if (failureType === 'edge') {
          failureTargets = selectedEdges;
        } else if (failureType === 'layer') {
          failureTargets = selectedLayers;
        }
        
        failed = applyFailure(graph, failureType, failureTargets);
      }
      setFailedGraph(failed);
      
      // Compute scenario metrics
      setProgress({ message: 'Computing scenario metrics...', percent: 50 });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const scenario = computeMetrics(failed, odPairs, objective);
      setScenarioMetrics(scenario);
      
      // Find top affected pairs
      const affected = [];
      for (let i = 0; i < baseline.results.length; i++) {
        const before = baseline.results[i];
        const after = scenario.results[i];
        if (before.reachable && after.reachable) {
          const delta = ((after.time - before.time) / before.time) * 100;
          if (delta > 0) {
            affected.push({
              ...before,
              timeBefore: before.time,
              timeAfter: after.time,
              delta,
              pathBefore: before.path ? before.path.join(' → ') : 'N/A',
              pathAfter: after.path ? after.path.join(' → ') : 'N/A'
            });
          }
        }
      }
      affected.sort((a, b) => b.delta - a.delta);
      setTopAffectedPairs(affected.slice(0, 10));
      
      // Run greedy recommendation if budget > 0
      if (budget > 0) {
        setProgress({ message: 'Generating candidate links...', percent: 60 });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const candidates = generateCandidates(nodes, graph, failed, scenario.results);
        
        setProgress({ message: 'Evaluating candidates (greedy selection)...', percent: 70 });
        
        const recommendation = greedyRecommendation(
          failed,
          candidates,
          odPairs,
          budget,
          objective,
          (prog) => {
            const percent = 70 + ((prog.candidateIndex / prog.totalCandidates) * 20);
            setProgress({
              message: `Evaluating candidate ${prog.candidateIndex + 1}/${prog.totalCandidates} (iteration ${prog.iteration + 1}/${prog.budget})`,
              percent: Math.round(percent)
            });
          },
          todMultiplier  // Pass time-of-day coefficients
        );
        
        console.log('Recommendation result:', recommendation);
        console.log('Selected links:', recommendation.selectedLinks);
        console.log('Number of links:', recommendation.selectedLinks?.length);
        
        setRecommendedLinks(recommendation.selectedLinks || []);
        setFixedGraph(recommendation.finalGraph);
        setFinalMetrics(recommendation.finalMetrics);
        
        setProgress({ message: 'Complete!', percent: 100 });
      } else {
        setRecommendedLinks([]);
        setFixedGraph(null);
        setFinalMetrics(null);
        setProgress({ message: 'Complete (no recommendations requested)', percent: 100 });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress({ message: '', percent: 0 });
      
      message.success('Scenario analysis complete!');
    } catch (error) {
      console.error('Error running scenario:', error);
      message.error('Error running scenario: ' + error.message);
      setProgress({ message: '', percent: 0 });
    } finally {
      setRunning(false);
    }
  }, [nodes, edges, source, destination, failureHubs, failureType, selectedEdges, selectedLayers, objective, timeOfDay, budget]);
  
  const edgeOptions = edges
    .slice(0, 100) // Limit for performance
    .map((e, i) => ({
      value: `${e.from_id}_${e.to_id}`,
      label: `${e.from_id} → ${e.to_id}`
    }));
  
  // Calculate deltas
  const calculateDelta = (before, after) => {
    if (!before || !after || before === 0) return 0;
    return ((after - before) / before) * 100;
  };
  
  // Generate summary
  const generateSummary = () => {
    if (!baselineMetrics || !scenarioMetrics) return '';
    
    const timeDelta = calculateDelta(baselineMetrics.avgTime, scenarioMetrics.avgTime);
    const disconnectedChange = scenarioMetrics.disconnected - baselineMetrics.disconnected;
    const todInfo = getTimeOfDayMultiplier();
    
    let summary = '';
    
    // Add time-of-day context
    summary += `[${todInfo.label}] `;
    
    if (failureType === 'none') {
      summary = `Network analysis with no failures. `;
      summary += `Average travel time: ${baselineMetrics.avgTime.toFixed(1)} minutes, `;
      summary += `${baselineMetrics.disconnected} disconnected OD pairs`;
    } else {
      summary += `Failure scenario `;
      
      if (failureType === 'node' && failureHubs.length > 0) {
        summary += `removing ${failureHubs.length} node(s) `;
      } else if (failureType === 'layer' && selectedLayers.length > 0) {
        summary += `removing ${selectedLayers.join(', ')} layer(s) `;
      }
      
      summary += `resulted in ${timeDelta.toFixed(1)}% ${timeDelta > 0 ? 'increase' : 'decrease'} in average travel time`;
      
      if (disconnectedChange > 0) {
        summary += ` and ${disconnectedChange} additional disconnected OD pairs`;
      }
    }
    
    if (finalMetrics && budget > 0) {
      const fixDelta = calculateDelta(scenarioMetrics.avgTime, finalMetrics.avgTime);
      summary += `. Greedy recommender added ${recommendedLinks.length} link(s), improving average time by ${Math.abs(fixDelta).toFixed(1)}%`;
    }
    
    summary += '.';
    return summary;
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" tip="Loading network data..." />
      </div>
    );
  }
  
  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🚇 Hyderabad Transport Network Resilience & Recommender</h1>
        <p>Simulate failures, analyze impact, and get automatic link recommendations</p>
      </div>
      
      <Row gutter={6}>
        {/* Left Column - Controls */}
        <Col span={5}>
          <Card title="Scenario Controls" className="control-card">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* Source */}
              <div>
                <label>Source</label>
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  value={source}
                  onChange={setSource}
                  placeholder="Select source..."
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  <Option value="All" label="All (Sample - 40 random OD pairs)">
                    All (Sample - 40 random OD pairs)
                  </Option>
                  {nodes
                    .filter(n => n.name && n.name.trim() !== '')
                    .sort((a, b) => {
                      const nameA = getDisplayName(a);
                      const nameB = getDisplayName(b);
                      return nameA.localeCompare(nameB);
                    })
                    .map(n => {
                      const displayName = getDisplayName(n);
                      return (
                        <Option key={n.node_id} value={n.node_id} label={`${displayName} (${n.layer})`}>
                          {displayName} ({n.layer})
                        </Option>
                      );
                    })}
                </Select>
              </div>
              
              {/* Destination */}
              <div>
                <label>Destination</label>
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  value={destination}
                  onChange={setDestination}
                  placeholder="Select destination..."
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  <Option value="All" label="All (Sample - 40 random OD pairs)">
                    All (Sample - 40 random OD pairs)
                  </Option>
                  {nodes
                    .filter(n => n.name && n.name.trim() !== '')
                    .sort((a, b) => {
                      const nameA = getDisplayName(a);
                      const nameB = getDisplayName(b);
                      return nameA.localeCompare(nameB);
                    })
                    .map(n => {
                      const displayName = getDisplayName(n);
                      return (
                        <Option key={n.node_id} value={n.node_id} label={`${displayName} (${n.layer})`}>
                          {displayName} ({n.layer})
                        </Option>
                      );
                    })}
                </Select>
              </div>
              
              {/* Failure Type */}
              <div>
                <label>Failure Type</label>
                <Radio.Group
                  value={failureType}
                  onChange={e => setFailureType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="none">None</Radio.Button>
                  <Radio.Button value="node">Node Down</Radio.Button>
                  <Radio.Button value="edge">Edge Down</Radio.Button>
                  <Radio.Button value="layer">Layer Down</Radio.Button>
                </Radio.Group>
              </div>
              
              {/* Failure Targets */}
              {failureType === 'node' && (
                <div>
                  <label>Failure Hub(s)</label>
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Select up to 3 nodes"
                    value={failureHubs}
                    onChange={val => setFailureHubs(val.slice(0, 3))}
                    maxTagCount={2}
                  >
                    {nodes.filter(n => n.name).map(n => (
                      <Option key={n.node_id} value={n.node_id}>
                        {n.name} ({n.layer})
                      </Option>
                    ))}
                  </Select>
                </div>
              )}
              
              {failureType === 'edge' && (
                <div>
                  <label>Select Edges</label>
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Select edges"
                    value={selectedEdges}
                    onChange={setSelectedEdges}
                    maxTagCount={2}
                  >
                    {edgeOptions.map(e => (
                      <Option key={e.value} value={e.value}>
                        {e.label}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}
              
              {failureType === 'layer' && (
                <div>
                  <label>Select Layers</label>
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Select layers to remove"
                    value={selectedLayers}
                    onChange={setSelectedLayers}
                  >
                    <Option value="metro">Metro</Option>
                    <Option value="mmts">MMTS</Option>
                    <Option value="bus">Bus</Option>
                    <Option value="auto">Auto</Option>
                  </Select>
                </div>
              )}
              
              {/* Objective */}
              <div>
                <label>
                  Objective{' '}
                  <Tooltip title="Fastest Time uses travel time weights. Least Cost uses monetary cost. Fewest Transfers prioritizes routes with fewer mode changes.">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </label>
                <Radio.Group
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="time">Fastest Time</Radio.Button>
                  <Radio.Button value="cost">Least Cost</Radio.Button>
                  <Radio.Button value="transfers">Fewest Transfers</Radio.Button>
                </Radio.Group>
              </div>
              
              {/* Time of Day */}
              <div>
                <label>
                  Time of Day{' '}
                  <Tooltip title="Simulates real-time traffic patterns in Hyderabad. Morning/Evening peaks have heavy traffic (+45-65% time, +25-35% cost). Night has light traffic (-15% time) but surge pricing (+40% cost). Afternoon has moderate conditions.">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </label>
                <Select
                  style={{ width: '100%' }}
                  value={timeOfDay}
                  onChange={setTimeOfDay}
                >
                  <Option value="morning">🌅 Morning Peak (7-10 AM)</Option>
                  <Option value="afternoon">☀️ Afternoon (12-4 PM)</Option>
                  <Option value="evening">🌆 Evening Peak (5-9 PM)</Option>
                  <Option value="night">🌙 Night (10 PM-6 AM)</Option>
                </Select>
              </div>
              
              {/* Budget */}
              <div>
                <label>
                  Budget (New Links){' '}
                  <Tooltip title="Maximum number of new links the system will automatically add to the failed network. The recommender runs automatically after you run the scenario if Budget > 0.">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </label>
                <Select
                  style={{ width: '100%' }}
                  value={budget === customBudget && customBudget > 10 ? 'custom' : budget}
                  onChange={val => {
                    if (val === 'custom') {
                      setBudget(customBudget);
                    } else {
                      setBudget(parseInt(val));
                      setCustomBudget(parseInt(val));
                    }
                  }}
                >
                  <Option value={0}>0 (No recommendations)</Option>
                  <Option value={1}>1</Option>
                  <Option value={2}>2 (default)</Option>
                  <Option value={3}>3</Option>
                  <Option value={5}>5</Option>
                  <Option value={10}>10</Option>
                  <Option value="custom">Custom</Option>
                </Select>
                {budget === customBudget && customBudget > 10 && (
                  <InputNumber
                    min={1}
                    max={20}
                    value={customBudget}
                    onChange={val => {
                      setCustomBudget(val);
                      setBudget(val);
                    }}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                )}
              </div>
              
              {/* Run Button */}
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={runScenario}
                loading={running}
                disabled={running}
                block
              >
                Run Scenario
              </Button>
              
              {/* Progress */}
              {running && progress.message && (
                <div>
                  <Progress percent={progress.percent} status="active" />
                  <p style={{ fontSize: 12, marginTop: 8, color: '#666' }}>
                    {progress.message}
                  </p>
                </div>
              )}
            </Space>
          </Card>
        </Col>
        
        {/* Center Column - Metrics */}
        <Col span={12}>
          <Card 
            title={
              <span>
                Results 
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {getTimeOfDayMultiplier().label}
                </Tag>
              </span>
            } 
            className="results-card"
          >
            {baselineMetrics && scenarioMetrics ? (
              <>
                <Row gutter={8}>
                  <Col span={8}>
                    <Card size="small" title="Before" headStyle={{ background: '#e6f7ff' }}>
                      <Statistic
                        title="Avg Travel Time"
                        value={baselineMetrics.avgTime.toFixed(2)}
                        suffix="min"
                      />
                      <Statistic
                        title="Avg Cost"
                        value={baselineMetrics.avgCost.toFixed(2)}
                        suffix="₹"
                      />
                      <Statistic
                        title="Avg Transfers"
                        value={baselineMetrics.avgTransfers.toFixed(2)}
                      />
                      <Statistic
                        title="Disconnected"
                        value={baselineMetrics.disconnected}
                      />
                    </Card>
                  </Col>
                  
                  <Col span={8}>
                    <Card size="small" title="After Failure" headStyle={{ background: '#fff1f0' }}>
                      <Statistic
                        title="Avg Travel Time"
                        value={scenarioMetrics.avgTime.toFixed(2)}
                        suffix="min"
                        valueStyle={{
                          color: scenarioMetrics.avgTime > baselineMetrics.avgTime ? '#cf1322' : '#3f8600'
                        }}
                      />
                      <Statistic
                        title="Avg Cost"
                        value={scenarioMetrics.avgCost.toFixed(2)}
                        suffix="₹"
                      />
                      <Statistic
                        title="Avg Transfers"
                        value={scenarioMetrics.avgTransfers.toFixed(2)}
                      />
                      <Statistic
                        title="Disconnected"
                        value={scenarioMetrics.disconnected}
                        valueStyle={{
                          color: scenarioMetrics.disconnected > baselineMetrics.disconnected ? '#cf1322' : '#3f8600'
                        }}
                      />
                    </Card>
                  </Col>
                  
                  <Col span={8}>
                    <Card size="small" title="Change (Δ%)" headStyle={{ background: '#f6ffed' }}>
                      <Statistic
                        title="Time Change"
                        value={calculateDelta(baselineMetrics.avgTime, scenarioMetrics.avgTime).toFixed(1)}
                        suffix="%"
                        valueStyle={{
                          color: scenarioMetrics.avgTime > baselineMetrics.avgTime ? '#cf1322' : '#3f8600'
                        }}
                        prefix={scenarioMetrics.avgTime > baselineMetrics.avgTime ? '+' : ''}
                      />
                      <Statistic
                        title="Cost Change"
                        value={calculateDelta(baselineMetrics.avgCost, scenarioMetrics.avgCost).toFixed(1)}
                        suffix="%"
                        prefix={scenarioMetrics.avgCost > baselineMetrics.avgCost ? '+' : ''}
                      />
                      <Statistic
                        title="Transfer Change"
                        value={calculateDelta(baselineMetrics.avgTransfers, scenarioMetrics.avgTransfers).toFixed(1)}
                        suffix="%"
                        prefix={scenarioMetrics.avgTransfers > baselineMetrics.avgTransfers ? '+' : ''}
                      />
                      <Statistic
                        title="New Disconnected"
                        value={scenarioMetrics.disconnected - baselineMetrics.disconnected}
                      />
                    </Card>
                  </Col>
                </Row>
                
                {finalMetrics && budget > 0 && (
                  <Card
                    size="small"
                    title={`After Recommendations (${recommendedLinks.length} links added)`}
                    headStyle={{ background: '#f0f9ff' }}
                    style={{ marginTop: 16 }}
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title="Avg Travel Time"
                          value={finalMetrics.avgTime.toFixed(2)}
                          suffix="min"
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="Improvement"
                          value={Math.abs(calculateDelta(scenarioMetrics.avgTime, finalMetrics.avgTime)).toFixed(1)}
                          suffix="%"
                          prefix="-"
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="Time Saved"
                          value={(scenarioMetrics.avgTime - finalMetrics.avgTime).toFixed(2)}
                          suffix="min"
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                    </Row>
                  </Card>
                )}
                
                {/* Route Details for Single OD Pair */}
                {source && destination && source !== 'All' && destination !== 'All' && baselineMetrics.results[0] && (
                  <Card 
                    title="📍 Detailed Route Breakdown" 
                    size="small"
                    style={{ marginTop: 16 }}
                  >
                    <Row gutter={16}>
                      {/* Before Failure Route */}
                      <Col span={12}>
                        <Card 
                          size="small" 
                          title={<span style={{ color: '#1890ff' }}>🟦 Before Failure</span>}
                          headStyle={{ background: '#e6f7ff', fontSize: '14px' }}
                        >
                          <div style={{ marginBottom: 12 }}>
                            <strong>Total:</strong> {baselineMetrics.results[0].time?.toFixed(2)} min | 
                            ₹{baselineMetrics.results[0].cost?.toFixed(2)} | 
                            {baselineMetrics.results[0].transfers} transfer(s)
                          </div>
                          
                          {baselineMetrics.results[0].pathSegments && baselineMetrics.results[0].pathSegments.length > 0 ? (
                            <div style={{ fontSize: '12px' }}>
                              {baselineMetrics.results[0].pathSegments.map((segment, idx) => (
                                <div 
                                  key={idx}
                                  style={{
                                    padding: '8px',
                                    marginBottom: '6px',
                                    background: idx % 2 === 0 ? '#fafafa' : '#fff',
                                    borderLeft: '3px solid #1890ff',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold' }}>
                                    {idx + 1}. {segment.from} → {segment.to}
                                  </div>
                                  <div style={{ color: '#666', marginTop: '4px' }}>
                                    <Tag color="blue">{segment.mode}</Tag>
                                    <span style={{ marginLeft: '8px' }}>
                                      ⏱️ {segment.time?.toFixed(1)} min
                                    </span>
                                    <span style={{ marginLeft: '8px' }}>
                                      💰 ₹{segment.cost?.toFixed(2)}
                                    </span>
                                    <span style={{ marginLeft: '8px' }}>
                                      📏 {segment.distance?.toFixed(2)} km
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#999' }}>No route details available</div>
                          )}
                        </Card>
                      </Col>
                      
                      {/* After Failure Route */}
                      <Col span={12}>
                        <Card 
                          size="small" 
                          title={
                            <span style={{ 
                              color: scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '#cf1322' : '#52c41a' 
                            }}>
                              {scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '🟥' : '🟩'} After Failure
                            </span>
                          }
                          headStyle={{ 
                            background: scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '#fff1f0' : '#f6ffed',
                            fontSize: '14px'
                          }}
                        >
                          <div style={{ marginBottom: 12 }}>
                            <strong>Total:</strong> {scenarioMetrics.results[0].time?.toFixed(2)} min | 
                            ₹{scenarioMetrics.results[0].cost?.toFixed(2)} | 
                            {scenarioMetrics.results[0].transfers} transfer(s)
                            {scenarioMetrics.results[0].time !== baselineMetrics.results[0].time && (
                              <div style={{ 
                                marginTop: '4px',
                                color: scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '#cf1322' : '#52c41a'
                              }}>
                                <small>
                                  {scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '▲' : '▼'} 
                                  {Math.abs(scenarioMetrics.results[0].time - baselineMetrics.results[0].time).toFixed(2)} min
                                  ({Math.abs(calculateDelta(baselineMetrics.results[0].time, scenarioMetrics.results[0].time)).toFixed(1)}%)
                                </small>
                              </div>
                            )}
                          </div>
                          
                          {scenarioMetrics.results[0].pathSegments && scenarioMetrics.results[0].pathSegments.length > 0 ? (
                            <div style={{ fontSize: '12px' }}>
                              {scenarioMetrics.results[0].pathSegments.map((segment, idx) => (
                                <div 
                                  key={idx}
                                  style={{
                                    padding: '8px',
                                    marginBottom: '6px',
                                    background: idx % 2 === 0 ? '#fafafa' : '#fff',
                                    borderLeft: `3px solid ${scenarioMetrics.results[0].time > baselineMetrics.results[0].time ? '#cf1322' : '#52c41a'}`,
                                    borderRadius: '4px'
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold' }}>
                                    {idx + 1}. {segment.from} → {segment.to}
                                  </div>
                                  <div style={{ color: '#666', marginTop: '4px' }}>
                                    <Tag color={segment.mode === 'metro' ? 'blue' : segment.mode === 'bus' ? 'orange' : 'green'}>
                                      {segment.mode}
                                    </Tag>
                                    <span style={{ marginLeft: '8px' }}>
                                      ⏱️ {segment.time?.toFixed(1)} min
                                    </span>
                                    <span style={{ marginLeft: '8px' }}>
                                      💰 ₹{segment.cost?.toFixed(2)}
                                    </span>
                                    <span style={{ marginLeft: '8px' }}>
                                      📏 {segment.distance?.toFixed(2)} km
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : scenarioMetrics.results[0].reachable ? (
                            <div style={{ color: '#999' }}>No route details available</div>
                          ) : (
                            <Alert message="Route Unreachable" type="error" showIcon />
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                )}
                
                {/* Comprehensive Network Analysis - Simplified */}
                {baselineMetrics && scenarioMetrics && (
                  <Card title="📊 Network Analysis" size="small" style={{ marginTop: 8 }}>
                    {/* Main Progression Charts */}
                    <Row gutter={8}>
                      {/* Travel Time Progression */}
                      <Col span={12}>
                        <Card size="small" title="⏱️ Travel Time Progression" headStyle={{ background: '#e6f7ff', fontSize: '12px' }}>
                          <div style={{ height: 280, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 15px' }}>
                            {[
                              { label: 'Baseline', value: baselineMetrics.avgTime, color: '#1890ff' },
                              { label: 'After Failure', value: scenarioMetrics.avgTime, color: '#ff4d4f' },
                              ...(finalMetrics && budget > 0 ? [{ 
                                label: 'After Fix', 
                                value: finalMetrics.avgTime, 
                                color: '#52c41a'
                              }] : [])
                            ].map((item, idx) => {
                              const maxVal = Math.max(baselineMetrics.avgTime, scenarioMetrics.avgTime, finalMetrics?.avgTime || 0);
                              const heightPercent = (item.value / maxVal) * 75;
                              return (
                                <div key={idx} style={{ flex: 1, margin: '0 8px', textAlign: 'center' }}>
                                  <div style={{
                                    background: `linear-gradient(180deg, ${item.color}, ${item.color}dd)`,
                                    height: `${heightPercent}%`,
                                    minHeight: '70px',
                                    borderRadius: '6px 6px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                  }}>
                                    <div style={{ fontSize: '28px' }}>{item.value.toFixed(1)}</div>
                                    <div style={{ fontSize: '11px', marginTop: 2, opacity: 0.9 }}>min</div>
                                    {idx > 0 && (
                                      <div style={{
                                        position: 'absolute',
                                        top: -24,
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        color: item.value > baselineMetrics.avgTime ? '#ff4d4f' : '#52c41a',
                                        background: 'white',
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                      }}>
                                        {item.value > baselineMetrics.avgTime ? '▲' : '▼'}
                                        {Math.abs(((item.value - baselineMetrics.avgTime) / baselineMetrics.avgTime * 100)).toFixed(1)}%
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 10, fontWeight: 'bold', color: item.color, fontSize: '12px' }}>
                                    {item.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </Col>

                      {/* Cost Progression */}
                      <Col span={12}>
                        <Card size="small" title="� Cost Progression" headStyle={{ background: '#fff7e6', fontSize: '12px' }}>
                          <div style={{ height: 280, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 15px' }}>
                            {[
                              { label: 'Baseline', value: baselineMetrics.avgCost, color: '#1890ff' },
                              { label: 'After Failure', value: scenarioMetrics.avgCost, color: '#fa8c16' },
                              ...(finalMetrics && budget > 0 ? [{ 
                                label: 'After Fix', 
                                value: finalMetrics.avgCost, 
                                color: '#52c41a'
                              }] : [])
                            ].map((item, idx) => {
                              const maxVal = Math.max(baselineMetrics.avgCost, scenarioMetrics.avgCost, finalMetrics?.avgCost || 0);
                              const heightPercent = (item.value / maxVal) * 75;
                              return (
                                <div key={idx} style={{ flex: 1, margin: '0 8px', textAlign: 'center' }}>
                                  <div style={{
                                    background: `linear-gradient(180deg, ${item.color}, ${item.color}dd)`,
                                    height: `${heightPercent}%`,
                                    minHeight: '70px',
                                    borderRadius: '6px 6px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                  }}>
                                    <div style={{ fontSize: '28px' }}>₹{item.value.toFixed(0)}</div>
                                    {idx > 0 && (
                                      <div style={{
                                        position: 'absolute',
                                        top: -24,
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        color: item.value > baselineMetrics.avgCost ? '#fa8c16' : '#52c41a',
                                        background: 'white',
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                      }}>
                                        {item.value > baselineMetrics.avgCost ? '▲' : '▼'}
                                        {Math.abs(((item.value - baselineMetrics.avgCost) / baselineMetrics.avgCost * 100)).toFixed(1)}%
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 10, fontWeight: 'bold', color: item.color, fontSize: '12px' }}>
                                    {item.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    {/* Efficiency Comparison Bar Charts */}
                    <Row gutter={8} style={{ marginTop: 8 }}>
                      {/* Network Efficiency Bar Chart */}
                      <Col span={12}>
                        <Card size="small" title="⚡ Network Efficiency Comparison" headStyle={{ background: '#f6ffed', fontSize: '12px' }}>
                          <div style={{ height: 240, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 15px' }}>
                            {[
                              { 
                                label: 'Baseline', 
                                value: 100, 
                                color: '#1890ff',
                                desc: 'Optimal'
                              },
                              { 
                                label: 'After Failure', 
                                value: (baselineMetrics.avgTime / scenarioMetrics.avgTime) * 100, 
                                color: '#ff4d4f',
                                desc: `${((1 - baselineMetrics.avgTime / scenarioMetrics.avgTime) * 100).toFixed(1)}% loss`
                              },
                              ...(finalMetrics && budget > 0 ? [{ 
                                label: 'After Recovery', 
                                value: (baselineMetrics.avgTime / finalMetrics.avgTime) * 100, 
                                color: '#52c41a',
                                desc: `${((baselineMetrics.avgTime / finalMetrics.avgTime - baselineMetrics.avgTime / scenarioMetrics.avgTime) * 100).toFixed(1)}% gain`
                              }] : [])
                            ].map((item, idx) => {
                              const maxVal = 100;
                              const heightPercent = (item.value / maxVal) * 70;
                              return (
                                <div key={idx} style={{ flex: 1, margin: '0 8px', textAlign: 'center' }}>
                                  <div style={{
                                    background: `linear-gradient(180deg, ${item.color}, ${item.color}dd)`,
                                    height: `${heightPercent}%`,
                                    minHeight: '60px',
                                    borderRadius: '6px 6px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                  }}>
                                    <div style={{ fontSize: '24px' }}>{item.value.toFixed(1)}%</div>
                                    <div style={{ fontSize: '10px', marginTop: 2, opacity: 0.9 }}>efficient</div>
                                  </div>
                                  <div style={{ marginTop: 10, fontWeight: 'bold', color: item.color, fontSize: '11px' }}>
                                    {item.label}
                                  </div>
                                  <div style={{ fontSize: '9px', color: '#999', marginTop: 2 }}>
                                    {item.desc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </Col>

                      {/* Throughput Comparison Bar Chart */}
                      <Col span={12}>
                        <Card size="small" title="🚀 Network Throughput (routes/hour)" headStyle={{ background: '#fff7e6', fontSize: '12px' }}>
                          <div style={{ height: 240, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 15px' }}>
                            {[
                              { 
                                label: 'Baseline', 
                                value: (1 / baselineMetrics.avgTime * 60), 
                                color: '#1890ff',
                                desc: 'Optimal speed'
                              },
                              { 
                                label: 'After Failure', 
                                value: (1 / scenarioMetrics.avgTime * 60), 
                                color: '#fa8c16',
                                desc: `-${((1 / baselineMetrics.avgTime - 1 / scenarioMetrics.avgTime) * 60).toFixed(2)} routes/hr`
                              },
                              ...(finalMetrics && budget > 0 ? [{ 
                                label: 'After Recovery', 
                                value: (1 / finalMetrics.avgTime * 60), 
                                color: '#52c41a',
                                desc: `+${((1 / finalMetrics.avgTime - 1 / scenarioMetrics.avgTime) * 60).toFixed(2)} routes/hr`
                              }] : [])
                            ].map((item, idx) => {
                              const maxVal = Math.max(
                                (1 / baselineMetrics.avgTime * 60), 
                                (1 / scenarioMetrics.avgTime * 60), 
                                finalMetrics ? (1 / finalMetrics.avgTime * 60) : 0
                              );
                              const heightPercent = (item.value / maxVal) * 70;
                              return (
                                <div key={idx} style={{ flex: 1, margin: '0 8px', textAlign: 'center' }}>
                                  <div style={{
                                    background: `linear-gradient(180deg, ${item.color}, ${item.color}dd)`,
                                    height: `${heightPercent}%`,
                                    minHeight: '60px',
                                    borderRadius: '6px 6px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                  }}>
                                    <div style={{ fontSize: '24px' }}>{item.value.toFixed(2)}</div>
                                    <div style={{ fontSize: '10px', marginTop: 2, opacity: 0.9 }}>routes/hr</div>
                                  </div>
                                  <div style={{ marginTop: 10, fontWeight: 'bold', color: item.color, fontSize: '11px' }}>
                                    {item.label}
                                  </div>
                                  <div style={{ fontSize: '9px', color: '#999', marginTop: 2 }}>
                                    {item.desc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    {/* Key Metrics Cards */}
                    <Row gutter={8} style={{ marginTop: 8 }}>
                      {/* Efficiency Loss */}
                      <Col span={6}>
                        <Card size="small" style={{ background: '#fff1f0', textAlign: 'center', height: '130px' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: 6 }}>Efficiency Loss</div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#cf1322' }}>
                            {((baselineMetrics.avgTime / scenarioMetrics.avgTime - 1) * -100).toFixed(1)}%
                          </div>
                          <Progress 
                            percent={Math.min(Math.abs((baselineMetrics.avgTime / scenarioMetrics.avgTime - 1) * 100), 100)}
                            strokeColor="#cf1322"
                            showInfo={false}
                            style={{ marginTop: 6 }}
                          />
                          <div style={{ fontSize: '10px', color: '#999', marginTop: 4 }}>
                            {((baselineMetrics.avgTime / scenarioMetrics.avgTime) * 100).toFixed(1)}% efficient
                          </div>
                        </Card>
                      </Col>

                      {/* Network Performance */}
                      <Col span={6}>
                        <Card size="small" style={{ background: '#f0f5ff', textAlign: 'center', height: '130px' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: 6 }}>Throughput Loss</div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff4d4f' }}>
                            {((1 / baselineMetrics.avgTime - 1 / scenarioMetrics.avgTime) * 60).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#999', marginTop: 4 }}>
                            fewer routes/hour
                          </div>
                          <div style={{ fontSize: '9px', color: '#666', marginTop: 8, padding: '4px', background: '#fff', borderRadius: '3px' }}>
                            {(1 / baselineMetrics.avgTime * 60).toFixed(2)} → {(1 / scenarioMetrics.avgTime * 60).toFixed(2)} routes/hr
                          </div>
                        </Card>
                      </Col>

                      {/* Avg Transfers */}
                      <Col span={6}>
                        <Card size="small" style={{ background: '#f0f5ff', textAlign: 'center', height: '130px' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: 6 }}>Average Transfers</div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>
                            {scenarioMetrics.avgTransfers.toFixed(2)}
                          </div>
                          <Progress
                            percent={Math.min(Math.abs(calculateDelta(baselineMetrics.avgTransfers, scenarioMetrics.avgTransfers)), 100)}
                            strokeColor={scenarioMetrics.avgTransfers > baselineMetrics.avgTransfers ? '#ff4d4f' : '#52c41a'}
                            showInfo={false}
                            style={{ marginTop: 6 }}
                          />
                          <div style={{ fontSize: '10px', color: '#999', marginTop: 4 }}>
                            vs {baselineMetrics.avgTransfers.toFixed(2)} baseline
                          </div>
                        </Card>
                      </Col>

                      {/* Network Connectivity */}
                      <Col span={6}>
                        <Card size="small" style={{ background: scenarioMetrics.disconnected > 0 ? '#fff1f0' : '#f6ffed', textAlign: 'center', height: '130px' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: 6 }}>Network Connectivity</div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: scenarioMetrics.disconnected > 0 ? '#cf1322' : '#52c41a' }}>
                            {((scenarioMetrics.validPairs / scenarioMetrics.totalPairs) * 100).toFixed(1)}%
                          </div>
                          <Progress
                            percent={((scenarioMetrics.validPairs / scenarioMetrics.totalPairs) * 100)}
                            strokeColor={scenarioMetrics.disconnected > 0 ? '#ff4d4f' : '#52c41a'}
                            showInfo={false}
                            style={{ marginTop: 6 }}
                          />
                          <div style={{ fontSize: '10px', color: '#999', marginTop: 4 }}>
                            {scenarioMetrics.validPairs} / {scenarioMetrics.totalPairs} reachable
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    {/* Recovery Metrics (if recommendations exist) */}
                    {finalMetrics && budget > 0 && recommendedLinks.length > 0 && (
                      <Row gutter={8} style={{ marginTop: 8 }}>
                        <Col span={12}>
                          <Card size="small" style={{ background: 'linear-gradient(135deg, #e6f7ff 0%, #f6ffed 100%)', border: '1px solid #52c41a' }}>
                            <Row gutter={8}>
                              <Col span={8}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: '#666' }}>Recovery Rate</div>
                                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#52c41a' }}>
                                    {((scenarioMetrics.avgTime - finalMetrics.avgTime) / (scenarioMetrics.avgTime - baselineMetrics.avgTime) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </Col>
                              <Col span={8}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: '#666' }}>Time Saved</div>
                                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>
                                    {(scenarioMetrics.avgTime - finalMetrics.avgTime).toFixed(1)} min
                                  </div>
                                </div>
                              </Col>
                              <Col span={8}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: '#666' }}>Cost Improvement</div>
                                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#52c41a' }}>
                                    -₹{(scenarioMetrics.avgCost - finalMetrics.avgCost).toFixed(1)}
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card size="small" style={{ background: '#fafafa' }}>
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: 6, textAlign: 'center' }}>🔧 Added {recommendedLinks.length} Link{recommendedLinks.length !== 1 ? 's' : ''}</div>
                            <Row gutter={4}>
                              {recommendedLinks.slice(0, 3).map((link, idx) => (
                                <Col span={8} key={idx}>
                                  <div style={{ fontSize: '9px', padding: '6px', background: '#fff', borderRadius: '3px', borderLeft: '2px solid #52c41a' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Link {idx + 1}</div>
                                    <div style={{ color: '#999' }}>{link.fromName?.substring(0, 12)}... ↔ {link.toName?.substring(0, 12)}...</div>
                                    <div style={{ color: '#52c41a', fontWeight: 'bold', marginTop: 2 }}>-{link.improvement.toFixed(1)} min</div>
                                  </div>
                                </Col>
                              ))}
                            </Row>
                          </Card>
                        </Col>
                      </Row>
                    )}
                  </Card>
                )}
                
                <Alert
                  message="Summary"
                  description={generateSummary()}
                  type="info"
                  style={{ marginTop: 16 }}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <p>Run a scenario to see results</p>
              </div>
            )}
          </Card>
          
          {/* Top Affected Pairs Table */}
          {topAffectedPairs.length > 0 && (
            <Card title="Top 10 Affected OD Pairs" style={{ marginTop: 16 }} size="small">
              <Table
                dataSource={topAffectedPairs}
                columns={[
                  { title: 'Origin', dataIndex: 'sourceName', key: 'source', width: 120 },
                  { title: 'Destination', dataIndex: 'targetName', key: 'target', width: 120 },
                  {
                    title: 'Before',
                    dataIndex: 'timeBefore',
                    key: 'before',
                    width: 80,
                    render: val => `${val.toFixed(1)}m`
                  },
                  {
                    title: 'After',
                    dataIndex: 'timeAfter',
                    key: 'after',
                    width: 80,
                    render: val => `${val.toFixed(1)}m`
                  },
                  {
                    title: 'Δ%',
                    dataIndex: 'delta',
                    key: 'delta',
                    width: 80,
                    render: val => (
                      <span style={{ color: val > 0 ? '#cf1322' : '#3f8600' }}>
                        +{val.toFixed(1)}%
                      </span>
                    ),
                    sorter: (a, b) => b.delta - a.delta
                  }
                ]}
                size="small"
                pagination={false}
                scroll={{ y: 300 }}
              />
            </Card>
          )}
        </Col>
        
        {/* Right Column - Visualizations */}
        <Col span={7}>
          <Card title="Visualizations" size="small" className="visualization-card">
            <Tabs defaultActiveKey="map">
              <TabPane tab="Map (Before)" key="map-before">
                {originalGraph && (
                  <NetworkMap
                    nodes={nodes}
                    graph={originalGraph}
                    failedNodes={[]}
                    recommendedLinks={[]}
                    height={500}
                  />
                )}
              </TabPane>
              
              <TabPane tab="Map (After)" key="map-after">
                {failedGraph && (
                  <NetworkMap
                    nodes={nodes}
                    graph={failedGraph}
                    failedNodes={failureHubs}
                    recommendedLinks={recommendedLinks}
                    height={500}
                  />
                )}
              </TabPane>
              
              {finalMetrics && budget > 0 && (
                <TabPane tab="Map (Fixed)" key="map-fixed">
                  {fixedGraph && (
                    <NetworkMap
                      nodes={nodes}
                      graph={fixedGraph}
                      failedNodes={failureHubs}
                      recommendedLinks={recommendedLinks}
                      showRecommended
                      height={500}
                    />
                  )}
                </TabPane>
              )}
            </Tabs>
          </Card>
          
          {/* Recommended Links Section - Always visible */}
          <Card 
            title={
              <span>
                ✨ Recommended Links 
                {recommendedLinks.length > 0 && (
                  <Tag color="success" style={{ marginLeft: 8 }}>
                    {recommendedLinks.length} Link{recommendedLinks.length !== 1 ? 's' : ''}
                  </Tag>
                )}
                {/* Debug badge */}
                <Tag color="purple" style={{ marginLeft: 4, fontSize: 10 }}>
                  Array length: {recommendedLinks?.length ?? 'null'}
                </Tag>
              </span>
            } 
            style={{ marginTop: 6 }} 
            size="small"
            headStyle={{ 
              background: recommendedLinks.length > 0 ? '#f6ffed' : '#fafafa', 
              borderBottom: recommendedLinks.length > 0 ? '2px solid #52c41a' : '1px solid #d9d9d9'
            }}
          >
            {recommendedLinks.length > 0 ? (
              <>
                <div className="recommended-links-scrollable">
                  {recommendedLinks.map((link, idx) => (
                    <Card 
                      key={idx} 
                      type="inner" 
                      size="small"
                      className="recommended-link-card"
                      style={{ 
                        marginBottom: 8,
                        borderLeft: '3px solid #52c41a',
                        background: '#fafafa',
                        animationDelay: `${idx * 0.1}s`
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <Tag color="green" style={{ fontWeight: 'bold' }}>
                          Link {idx + 1}
                        </Tag>
                        <Tag color="blue" style={{ fontSize: '10px' }}>
                          {link.type.replace(/_/g, ' ')}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#000' }}>
                        🔗 {link.fromName} ↔ {link.toName}
                      </div>
                      <Row gutter={8}>
                        <Col span={6}>
                          <div style={{ fontSize: 10, color: '#999' }}>Distance</div>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1890ff' }}>
                            {link.distance.toFixed(2)} km
                          </div>
                        </Col>
                        <Col span={6}>
                          <div style={{ fontSize: 10, color: '#999' }}>Est. Time</div>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fa8c16' }}>
                            {link.time.toFixed(1)} min
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 10, color: '#999' }}>Improvement</div>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#52c41a' }}>
                            -{link.improvement.toFixed(2)} min avg
                          </div>
                        </Col>
                      </Row>
                      <div style={{ 
                        marginTop: 8, 
                        padding: '4px 8px', 
                        background: '#e6f7ff', 
                        borderRadius: '4px',
                        fontSize: 11,
                        color: '#096dd9'
                      }}>
                        💰 Est. Cost: ₹{(link.distance * 50000).toFixed(0)}k
                      </div>
                    </Card>
                  ))}
                </div>
                
                {/* Summary Statistics */}
                <Card 
                  size="small" 
                  style={{ 
                    marginTop: 12, 
                    background: 'linear-gradient(135deg, #e6f7ff 0%, #f6ffed 100%)',
                    border: '1px solid #52c41a'
                  }}
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#666' }}>Total Links</div>
                        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                          {recommendedLinks.length}
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#666' }}>Total Distance</div>
                        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fa8c16' }}>
                          {recommendedLinks.reduce((sum, link) => sum + link.distance, 0).toFixed(1)} km
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#666' }}>Avg. Improvement</div>
                        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                          -{(recommendedLinks.reduce((sum, link) => sum + link.improvement, 0) / recommendedLinks.length).toFixed(2)} min
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: '#999' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>No Recommended Links Yet</div>
                <div style={{ fontSize: 12 }}>
                  {budget === 0 ? (
                    <>Set Budget &gt; 0 and run a scenario to see recommendations</>
                  ) : !scenarioMetrics ? (
                    <>Click "Run Scenario" to generate recommendations</>
                  ) : (
                    <>Run a scenario with budget &gt; 0 to get link recommendations</>
                  )}
                </div>
              </div>
            )}
          </Card>
          
          {budget === 0 && scenarioMetrics && recommendedLinks.length === 0 && (
            <Alert
              message="💡 Tip: Enable Recommendations"
              description="Budget is set to 0. Increase the budget (in controls) to get automatic link recommendations that can help recover network performance."
              type="info"
              style={{ marginTop: 6 }}
              showIcon
            />
          )}
        </Col>
      </Row>
    </div>
  );
}

export default App;
