import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const NetworkMap = ({
  nodes,
  graph,
  failedNodes = [],
  recommendedLinks = [],
  showRecommended = false,
  height = 400
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  useEffect(() => {
    if (!mapRef.current || !nodes || nodes.length === 0) return;
    
    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([17.385, 78.4867], 11);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(mapInstanceRef.current);
    }
    
    const map = mapInstanceRef.current;
    
    // Clear existing layers (except base tile layer)
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });
    
    // Layer colors
    const layerColors = {
      metro: '#e74c3c',
      mmts: '#3498db',
      bus: '#2ecc71',
      auto: '#f39c12'
    };
    
    // Draw edges from graph
    if (graph) {
      const drawnEdges = new Set();
      
      graph.forEachEdge((edge, attributes, source, target) => {
        const edgeKey = [source, target].sort().join('_');
        if (drawnEdges.has(edgeKey)) return;
        drawnEdges.add(edgeKey);
        
        const sourceNode = nodes.find(n => n.node_id === source);
        const targetNode = nodes.find(n => n.node_id === target);
        
        if (!sourceNode || !targetNode) return;
        
        const layer = attributes.layer || 'auto';
        const color = layerColors[layer] || '#95a5a6';
        
        L.polyline(
          [[sourceNode.lat, sourceNode.lon], [targetNode.lat, targetNode.lon]],
          {
            color,
            weight: attributes.type === 'transfer' ? 1 : 2,
            opacity: attributes.type === 'transfer' ? 0.3 : 0.6,
            dashArray: attributes.type === 'transfer' ? '5, 5' : null
          }
        ).addTo(map);
      });
    }
    
    // Draw recommended links in green
    if (showRecommended && recommendedLinks.length > 0) {
      recommendedLinks.forEach(link => {
        const fromNode = nodes.find(n => n.node_id === link.from);
        const toNode = nodes.find(n => n.node_id === link.to);
        
        if (!fromNode || !toNode) return;
        
        L.polyline(
          [[fromNode.lat, fromNode.lon], [toNode.lat, toNode.lon]],
          {
            color: '#52c41a',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
          }
        ).bindPopup(`
            <strong>New Link ${recommendedLinks.indexOf(link) + 1}</strong><br/>
            ${link.fromName} ↔ ${link.toName}<br/>
            Type: ${link.type}<br/>
            Distance: ${link.distance.toFixed(2)} km<br/>
            Improvement: -${link.improvement.toFixed(2)} min
          `)
          .addTo(map);
      });
    }
    
    // Draw nodes
    const majorNodes = nodes.filter(n => 
      n.layer === 'metro' || 
      n.layer === 'mmts' || 
      (n.name && n.name.length > 0)
    );
    
    majorNodes.forEach(node => {
      const isFailed = failedNodes.includes(node.node_id);
      const color = isFailed ? '#cf1322' : layerColors[node.layer] || '#95a5a6';
      
      const marker = L.circleMarker([node.lat, node.lon], {
        radius: isFailed ? 8 : (node.layer === 'metro' || node.layer === 'mmts' ? 5 : 3),
        fillColor: color,
        color: isFailed ? '#fff' : color,
        weight: isFailed ? 3 : 1,
        opacity: 1,
        fillOpacity: isFailed ? 0.9 : 0.8
      });
      
      if (node.name) {
        marker.bindPopup(`
          <strong>${node.name}</strong><br/>
          Layer: ${node.layer}<br/>
          ID: ${node.node_id}
          ${isFailed ? '<br/><span style="color: red; font-weight: bold;">⚠ FAILED</span>' : ''}
        `);
      }
      
      marker.addTo(map);
    });
    
    // Fit bounds to show all nodes
    if (majorNodes.length > 0) {
      const bounds = L.latLngBounds(majorNodes.map(n => [n.lat, n.lon]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
    
  }, [nodes, graph, failedNodes, recommendedLinks, showRecommended]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);
  
  return <div ref={mapRef} style={{ height: `${height}px`, width: '100%' }} />;
};

export default NetworkMap;
