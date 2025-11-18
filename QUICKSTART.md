# 🚀 Quick Start Guide - Resilience App

## ✅ Prerequisites Checklist

- [x] Node.js 14+ installed
- [x] npm 6+ installed
- [x] CSV data files (nodes.csv, edges.csv)
- [x] Modern web browser (Chrome, Firefox, Safari, Edge)

## 📦 Installation & Setup

### Step 1: Navigate to Project Directory
```bash
cd /home/sigullapalliakash/Documents/sem5/DPCN/Hyd_Urban_Mobility_&_Public_Transport_Networks/resilience-app
```

### Step 2: Install Dependencies (First Time Only)
```bash
npm install
```
**Note**: This takes ~2 minutes and installs 1,660 packages. Some deprecation warnings are normal.

### Step 3: Verify Data Files
Ensure these files exist in `public/`:
```bash
ls public/*.csv
```
Expected output:
```
public/nodes.csv
public/edges.csv
```

If missing, copy from parent directory:
```bash
cp ../nodes.csv public/
cp ../edges.csv public/
```

### Step 4: Start Development Server
```bash
npm start
```

**Expected Output:**
```
Compiled with warnings.
...
webpack compiled with 1 warning

You can now view resilience-app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

**Known Warnings (Safe to Ignore):**
- plotly.js source map missing (cosmetic)
- Unused imports in App.js (reserved for future features)
- React Hook dependency in useCallback (optimization suggestion)

### Step 5: Open in Browser
The app automatically opens at `http://localhost:3000`

If not, manually navigate to:
- **Local access**: http://localhost:3000
- **Network access**: http://YOUR_IP:3000

## 🎯 First Test Scenario

### Recommended First Run:
1. **Source**: All (Sample)
2. **Destination**: All (Sample)
3. **Failure Type**: Node Down
4. **Failure Hubs**: Select "AMEERPET" from dropdown
5. **Objective**: Fastest Time
6. **Time of Day**: Off-peak
7. **Budget**: 2

Click **"Run Scenario"** → Wait 3-5 seconds

### Expected Results:
- Before metrics: ~25-35 min avg time
- After failure: ~30-45 min avg time (+10-30%)
- 2 recommended links displayed
- Maps show red failed node at Ameerpet
- Green dashed lines show recommendations

## 📊 App Features Overview

### Left Panel - Controls
- **Source/Destination**: Autocomplete search for stations
- **Failure Type**: Choose what breaks (node/edge/layer)
- **Failure Targets**: Select specific failures
- **Objective**: Optimize for time/cost/transfers
- **Time of Day**: Apply peak-hour congestion
- **Budget**: Number of new links (0-20)

### Center Panel - Metrics
- **Before**: Baseline network performance
- **After Failure**: Impact of disruption
- **Change (Δ%)**: Percentage differences
- **After Recommendations**: Improvement from greedy algorithm
- **Summary Alert**: Natural language description
- **Top 10 Affected Pairs**: Most delayed routes

### Right Panel - Visualizations
- **Map (Before)**: Original network
- **Map (After)**: Failed network with red highlights
- **Map (Fixed)**: With recommended links (green)
- **Recommended Links**: Detailed link cards

## 🧪 Example Test Scenarios

### Scenario 1: Single Station Failure (Quick)
```
Source: All
Destination: All
Failure Type: Node Down
Failure Hubs: KACHEGUDA
Objective: Fastest Time
Time of Day: Off-peak
Budget: 2
Runtime: ~3-5 seconds
```

### Scenario 2: Metro System Shutdown (Moderate)
```
Source: All
Destination: All
Failure Type: Layer Down
Selected Layers: metro
Objective: Fastest Time
Time of Day: Peak PM
Budget: 5
Runtime: ~15-20 seconds
```

### Scenario 3: Specific OD Pair (Fast)
```
Source: SECUNDERABAD_JUNCTION
Destination: KACHEGUDA
Failure Type: Node Down
Failure Hubs: PARADE_GROUND
Objective: Fewest Transfers
Time of Day: Peak AM
Budget: 1
Runtime: ~1-2 seconds
```

### Scenario 4: Major Interchange Down (Comprehensive)
```
Source: All
Destination: All
Failure Type: Node Down
Failure Hubs: AMEERPET, MIYAPUR, GANDHI_BHAVAN
Objective: Fastest Time
Time of Day: Peak PM
Budget: 10
Runtime: ~30-40 seconds
```

## 🔧 Troubleshooting

### Issue: "Network data not loaded"
**Solution:**
```bash
# Verify files exist
ls public/nodes.csv public/edges.csv

# If missing, copy from parent
cp ../nodes.csv ../edges.csv public/

# Refresh browser (Ctrl+R)
```

### Issue: Blank screen or loading forever
**Solution:**
```bash
# Check browser console (F12)
# Common fix: Clear cache and reload (Ctrl+Shift+R)

# Restart server
# Press Ctrl+C in terminal
npm start
```

### Issue: Maps not showing
**Solution:**
- Check internet connection (uses OpenStreetMap tiles)
- Verify nodes have valid lat/lon coordinates
- Check browser console for Leaflet errors

### Issue: Greedy algorithm taking too long
**Solution:**
- Reduce Budget to 2-3 (instead of 10)
- Use specific OD pair (not "All")
- Use "Off-peak" time of day
- Close other browser tabs

### Issue: Port 3000 already in use
**Solution:**
```bash
# Use custom port
PORT=3001 npm start

# Or kill existing process
lsof -ti:3000 | xargs kill -9
npm start
```

## 📱 Browser Compatibility

### ✅ Fully Supported
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### ⚠️ Limited Support
- Mobile browsers (layout responsive but touch interactions limited)
- Safari < 14 (some CSS features missing)

### ❌ Not Supported
- Internet Explorer 11
- Opera Mini
- Legacy Android Browser

## 🛑 Stopping the Server

Press `Ctrl+C` in the terminal running the server.

## 🏗️ Building for Production

```bash
# Create optimized production build
npm run build

# Serve locally to test
npx serve -s build

# Deploy to web hosting
# Upload `build/` folder to Netlify, Vercel, GitHub Pages, etc.
```

## 📈 Performance Tips

### For Fastest Results:
1. Use specific OD pairs (not "All")
2. Keep budget ≤ 3
3. Use "Off-peak" time of day
4. Close unnecessary browser tabs
5. Use Chrome (fastest React rendering)

### For Most Comprehensive Analysis:
1. Use "All" for source/destination
2. Set budget to 5-10
3. Use "Peak PM" to see worst-case
4. Let it run in foreground tab
5. Expect 20-40 second runtime

## 🆘 Getting Help

### Check Console Errors:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Screenshot and share if asking for help

### Common Console Errors:

**"Failed to fetch nodes.csv"**
→ Copy CSV files to public/ folder

**"Cannot read property 'lat' of undefined"**
→ Check nodes.csv has lat/lon columns

**"Maximum call stack size exceeded"**
→ Reduce Budget or use simpler scenario

## 📚 Next Steps

1. ✅ Test recommended scenarios above
2. ✅ Try different failure types (node/edge/layer)
3. ✅ Experiment with budget values (0-10)
4. ✅ Compare peak vs off-peak impacts
5. ✅ Read full DOCUMENTATION.md for algorithm details
6. ✅ Check README.md for feature overview

## 🎓 Learning Outcomes

After running scenarios, you should understand:
- How network resilience is measured (time, cost, transfers)
- Impact of removing critical nodes (interchanges)
- Greedy algorithm for link recommendation
- Trade-offs between budget and improvement
- Importance of multi-modal redundancy

## ✨ Success Indicators

Your app is working correctly if:
- ✅ Maps render with colored markers
- ✅ Scenarios complete in < 40 seconds
- ✅ Metrics show realistic values (~20-60 min travel times)
- ✅ Recommended links are geographically sensible
- ✅ Top affected pairs match failed nodes

---

**Need Help?** Check DOCUMENTATION.md for detailed technical information.

**Found a Bug?** Check browser console and verify CSV data format.

**Want to Extend?** See "Future Enhancements" section in DOCUMENTATION.md.

---

**Happy Testing! 🎉**
