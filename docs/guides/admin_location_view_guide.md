# 🗺️ Admin Location Viewer - Real-Time Employee Tracking Dashboard

دليل شامل لبناء لوحة تحكم إدارية لمشاهدة حركة الموظفين في الوقت الفعلي

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Real-Time Viewer](#real-time-viewer)
3. [Historical Viewer](#historical-viewer)
4. [Multi-Employee Viewer](#multi-employee-viewer)
5. [Live Dashboard](#live-dashboard)
6. [React Implementation](#react-implementation)
7. [Vue.js Implementation](#vuejs-implementation)
8. [Advanced Features](#advanced-features)

---

## 🎯 Overview

لوحة التحكم الإدارية تسمح لـ HR Manager/المدير بـ:

```
✅ مشاهدة موقع الموظفين في الوقت الفعلي (Live)
✅ عرض مسار الموظف خلال اليوم (Historical)
✅ مشاهدة عدة موظفين على خريطة واحدة
✅ تحديث تلقائي كل عدة ثواني
✅ إحصائيات مباشرة (المسافة، الوقت، السرعة)
```

---

## 🔴 Real-Time Viewer (المشاهدة المباشرة)

### Single Employee Real-Time Tracker

```javascript
class RealTimeEmployeeTracker {
  constructor(mapContainerId) {
    this.mapContainerId = mapContainerId
    this.map = null
    this.currentMarker = null
    this.polyline = null
    this.allCoordinates = []
    this.updateInterval = null
    this.employee = null
    this.apiUrl = null
    this.authToken = null
  }

  // Initialize tracker
  async init(employee, apiUrl, authToken) {
    this.employee = employee
    this.apiUrl = apiUrl
    this.authToken = authToken

    // Initialize map
    this.initMap()

    // Load today's locations
    await this.loadTodayLocations()

    // Start real-time updates
    this.startRealTimeUpdates()
  }

  // Initialize Leaflet map
  initMap() {
    // Default center (will be updated with first location)
    this.map = L.map(this.mapContainerId).setView([31.2344576, 30.0056576], 13)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map)

    console.log('🗺️ Map initialized')
  }

  // Load all locations for today
  async loadTodayLocations() {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${this.apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
        `employee=${this.employee}&date=${today}`,
        {
          headers: { 'Authorization': `token ${this.authToken}` }
        }
      )

      const data = await response.json()
      const locations = data.message || []

      if (locations.length === 0) {
        console.log('⚠️ لا توجد مواقع لهذا الموظف اليوم')
        return
      }

      // Store all coordinates
      this.allCoordinates = locations.map(loc => [loc.latitude, loc.longitude])

      // Draw initial polyline
      this.drawPolyline()

      // Add current position marker
      const lastLocation = locations[locations.length - 1]
      this.updateCurrentMarker(lastLocation)

      // Center map on current position
      this.map.setView([lastLocation.latitude, lastLocation.longitude], 15)

      console.log(`✅ Loaded ${locations.length} locations`)

    } catch (error) {
      console.error('❌ Failed to load locations:', error)
    }
  }

  // Draw polyline (the blue path)
  drawPolyline() {
    // Remove old polyline
    if (this.polyline) {
      this.map.removeLayer(this.polyline)
    }

    // Draw new polyline
    this.polyline = L.polyline(this.allCoordinates, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
      smoothFactor: 1
    }).addTo(this.map)
  }

  // Update current position marker
  updateCurrentMarker(location) {
    // Remove old marker
    if (this.currentMarker) {
      this.map.removeLayer(this.currentMarker)
    }

    // Create pulsing marker for current position
    const pulsingIcon = L.divIcon({
      className: 'pulsing-marker',
      html: `
        <div class="pulse-container">
          <div class="pulse-marker">
            <div class="pulse-icon">📍</div>
          </div>
          <div class="pulse-ring"></div>
        </div>
      `,
      iconSize: [40, 40]
    })

    // Add new marker
    this.currentMarker = L.marker(
      [location.latitude, location.longitude],
      { icon: pulsingIcon }
    ).addTo(this.map)

    // Add popup with info
    this.currentMarker.bindPopup(`
      <div style="min-width: 200px;">
        <h4>🔴 الموقع الحالي</h4>
        <p><strong>⏰ الوقت:</strong> ${this.formatTime(location.log_datetime)}</p>
        <p><strong>📍 العنوان:</strong> ${location.address || 'جاري التحديد...'}</p>
        <p><strong>🎯 الدقة:</strong> ${location.accuracy ? location.accuracy.toFixed(1) + 'm' : 'N/A'}</p>
      </div>
    `).openPopup()
  }

  // Start real-time updates (every 10 seconds)
  startRealTimeUpdates() {
    console.log('🔴 بدء التحديث المباشر...')

    this.updateInterval = setInterval(async () => {
      await this.fetchLatestLocation()
    }, 10000) // Update every 10 seconds
  }

  // Fetch latest location
  async fetchLatestLocation() {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${this.apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
        `employee=${this.employee}&date=${today}`,
        {
          headers: { 'Authorization': `token ${this.authToken}` }
        }
      )

      const data = await response.json()
      const locations = data.message || []

      if (locations.length === 0) return

      const lastLocation = locations[locations.length - 1]
      const newCoord = [lastLocation.latitude, lastLocation.longitude]

      // Check if this is a new location
      const lastCoord = this.allCoordinates[this.allCoordinates.length - 1]
      if (!lastCoord || lastCoord[0] !== newCoord[0] || lastCoord[1] !== newCoord[1]) {
        console.log('🆕 موقع جديد:', newCoord)
        
        // Add new coordinate
        this.allCoordinates.push(newCoord)
        
        // Update polyline
        this.drawPolyline()
        
        // Update marker
        this.updateCurrentMarker(lastLocation)
        
        // Animate map to new position
        this.map.flyTo(newCoord, 15, {
          duration: 1 // 1 second animation
        })

        // Update stats
        this.updateStats(locations)
      }

    } catch (error) {
      console.error('❌ Failed to fetch latest location:', error)
    }
  }

  // Update statistics
  updateStats(locations) {
    const statsDiv = document.getElementById('live-stats')
    if (!statsDiv) return

    // Calculate distance
    let totalDistance = 0
    for (let i = 1; i < locations.length; i++) {
      totalDistance += this.calculateDistance(
        locations[i - 1].latitude,
        locations[i - 1].longitude,
        locations[i].latitude,
        locations[i].longitude
      )
    }

    // Calculate duration
    const firstTime = new Date(locations[0].log_datetime)
    const lastTime = new Date(locations[locations.length - 1].log_datetime)
    const durationMs = lastTime - firstTime
    const hours = Math.floor(durationMs / 3600000)
    const minutes = Math.floor((durationMs % 3600000) / 60000)

    // Calculate average speed
    const avgSpeed = durationMs > 0 ? (totalDistance / (durationMs / 3600000)) : 0

    statsDiv.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📍</div>
          <div class="stat-value">${locations.length}</div>
          <div class="stat-label">نقاط التتبع</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚗</div>
          <div class="stat-value">${totalDistance.toFixed(1)} كم</div>
          <div class="stat-label">المسافة المقطوعة</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-value">${hours}س ${minutes}د</div>
          <div class="stat-label">مدة الشفت</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${avgSpeed.toFixed(1)} كم/س</div>
          <div class="stat-label">متوسط السرعة</div>
        </div>
      </div>
      <div class="last-update">
        آخر تحديث: ${this.formatTime(locations[locations.length - 1].log_datetime)}
      </div>
    `
  }

  // Stop real-time updates
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
      console.log('⏹️ توقف التحديث المباشر')
    }
  }

  // Helper: Calculate distance
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Helper: Format time
  formatTime(datetime) {
    return new Date(datetime).toLocaleString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
}

// CSS for pulsing marker
const style = document.createElement('style')
style.textContent = `
.pulsing-marker {
  position: relative;
}

.pulse-container {
  position: relative;
  width: 40px;
  height: 40px;
}

.pulse-marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
}

.pulse-icon {
  font-size: 24px;
  animation: bounce 1s infinite;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    width: 40px;
    height: 40px;
    opacity: 1;
  }
  100% {
    width: 80px;
    height: 80px;
    opacity: 0;
  }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.last-update {
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  padding: 10px;
  background: #f3f4f6;
  border-radius: 6px;
}
`
document.head.appendChild(style)
```

### Usage - Real-Time Viewer

```html
<!DOCTYPE html>
<html>
<head>
  <title>Real-Time Employee Tracker</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin: 0 0 10px 0;
      color: #1f2937;
    }
    #live-stats {
      margin-bottom: 20px;
    }
    #map {
      height: 600px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .controls {
      margin-top: 15px;
    }
    .btn {
      padding: 10px 20px;
      margin-right: 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-danger {
      background: #ef4444;
      color: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗺️ تتبع الموظف المباشر</h1>
      <p>مشاهدة حركة الموظف في الوقت الفعلي</p>
      
      <div class="controls">
        <select id="employee-select" class="btn">
          <option value="">اختر موظف...</option>
          <option value="HR-EMP-00006">Ahmed Mohamed</option>
          <option value="HR-EMP-00007">Sara Ali</option>
        </select>
        <button id="start-btn" class="btn btn-primary">🔴 بدء التتبع المباشر</button>
        <button id="stop-btn" class="btn btn-danger" style="display:none;">⏹️ إيقاف</button>
      </div>
    </div>

    <div id="live-stats"></div>
    <div id="map"></div>
  </div>

  <script src="real-time-tracker.js"></script>
  <script>
    let tracker = null

    document.getElementById('start-btn').addEventListener('click', () => {
      const employee = document.getElementById('employee-select').value
      if (!employee) {
        alert('اختر موظف أولاً')
        return
      }

      // Initialize tracker
      tracker = new RealTimeEmployeeTracker('map')
      tracker.init(
        employee,
        'https://base.meena.sa',
        'YOUR_AUTH_TOKEN'
      )

      document.getElementById('start-btn').style.display = 'none'
      document.getElementById('stop-btn').style.display = 'inline-block'
    })

    document.getElementById('stop-btn').addEventListener('click', () => {
      if (tracker) {
        tracker.stop()
      }
      document.getElementById('start-btn').style.display = 'inline-block'
      document.getElementById('stop-btn').style.display = 'none'
    })
  </script>
</body>
</html>
```

---

## 📊 Multi-Employee Viewer (عدة موظفين)

```javascript
class MultiEmployeeViewer {
  constructor(mapContainerId) {
    this.mapContainerId = mapContainerId
    this.map = null
    this.employeeMarkers = {}
    this.employeePolylines = {}
    this.updateInterval = null
    this.employees = []
    this.apiUrl = null
    this.authToken = null
  }

  // Initialize with multiple employees
  async init(employees, apiUrl, authToken) {
    this.employees = employees
    this.apiUrl = apiUrl
    this.authToken = authToken

    // Initialize map
    this.initMap()

    // Load all employees
    await this.loadAllEmployees()

    // Start updates
    this.startUpdates()
  }

  initMap() {
    this.map = L.map(this.mapContainerId).setView([31.2344576, 30.0056576], 12)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map)
  }

  // Load all employees
  async loadAllEmployees() {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
    
    for (let i = 0; i < this.employees.length; i++) {
      const employee = this.employees[i]
      const color = colors[i % colors.length]
      
      await this.loadEmployee(employee.id, employee.name, color)
    }

    // Fit map to show all employees
    this.fitAllEmployees()
  }

  // Load single employee
  async loadEmployee(employeeId, employeeName, color) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${this.apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
        `employee=${employeeId}&date=${today}`,
        {
          headers: { 'Authorization': `token ${this.authToken}` }
        }
      )

      const data = await response.json()
      const locations = data.message || []

      if (locations.length === 0) {
        console.log(`⚠️ لا توجد مواقع لـ ${employeeName}`)
        return
      }

      // Draw polyline
      const coordinates = locations.map(loc => [loc.latitude, loc.longitude])
      const polyline = L.polyline(coordinates, {
        color: color,
        weight: 3,
        opacity: 0.7
      }).addTo(this.map)

      this.employeePolylines[employeeId] = polyline

      // Add marker for current position
      const lastLocation = locations[locations.length - 1]
      const marker = L.circleMarker(
        [lastLocation.latitude, lastLocation.longitude],
        {
          radius: 10,
          fillColor: color,
          color: 'white',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }
      ).addTo(this.map)

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <h4>${employeeName}</h4>
          <p><strong>⏰</strong> ${this.formatTime(lastLocation.log_datetime)}</p>
          <p><strong>📍</strong> ${lastLocation.address || 'جاري التحديد...'}</p>
        </div>
      `)

      this.employeeMarkers[employeeId] = {
        marker: marker,
        name: employeeName,
        color: color,
        locations: locations
      }

      console.log(`✅ تم تحميل ${employeeName}`)

    } catch (error) {
      console.error(`❌ فشل تحميل ${employeeName}:`, error)
    }
  }

  // Fit map to show all employees
  fitAllEmployees() {
    const bounds = []
    
    Object.values(this.employeeMarkers).forEach(emp => {
      emp.locations.forEach(loc => {
        bounds.push([loc.latitude, loc.longitude])
      })
    })

    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  // Start periodic updates
  startUpdates() {
    this.updateInterval = setInterval(async () => {
      for (const employee of this.employees) {
        await this.updateEmployee(employee.id)
      }
    }, 15000) // Update every 15 seconds
  }

  // Update single employee
  async updateEmployee(employeeId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${this.apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
        `employee=${employeeId}&date=${today}`,
        {
          headers: { 'Authorization': `token ${this.authToken}` }
        }
      )

      const data = await response.json()
      const locations = data.message || []

      if (locations.length === 0) return

      const empData = this.employeeMarkers[employeeId]
      if (!empData) return

      // Check if there's a new location
      const lastLocation = locations[locations.length - 1]
      const oldLastLocation = empData.locations[empData.locations.length - 1]

      if (lastLocation.name !== oldLastLocation.name) {
        console.log(`🆕 موقع جديد لـ ${empData.name}`)

        // Update stored locations
        empData.locations = locations

        // Update polyline
        const coordinates = locations.map(loc => [loc.latitude, loc.longitude])
        this.employeePolylines[employeeId].setLatLngs(coordinates)

        // Update marker
        empData.marker.setLatLng([lastLocation.latitude, lastLocation.longitude])
        empData.marker.setPopupContent(`
          <div style="min-width: 180px;">
            <h4>${empData.name}</h4>
            <p><strong>⏰</strong> ${this.formatTime(lastLocation.log_datetime)}</p>
            <p><strong>📍</strong> ${lastLocation.address || 'جاري التحديد...'}</p>
          </div>
        `)
      }

    } catch (error) {
      console.error(`❌ فشل تحديث ${employeeId}:`, error)
    }
  }

  // Stop updates
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      console.log('⏹️ توقف التحديث')
    }
  }

  formatTime(datetime) {
    return new Date(datetime).toLocaleString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}
```

### Usage - Multi-Employee Viewer

```html
<!DOCTYPE html>
<html>
<head>
  <title>Multi-Employee Tracker</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    #map { height: 700px; }
    .legend {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .legend-item {
      display: inline-block;
      margin-right: 20px;
      padding: 5px 10px;
    }
    .legend-color {
      display: inline-block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      margin-right: 5px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <h1>🗺️ تتبع الموظفين - عرض جماعي</h1>
  
  <div class="legend" id="legend"></div>
  <div id="map"></div>

  <script src="multi-employee-viewer.js"></script>
  <script>
    const employees = [
      { id: 'HR-EMP-00006', name: 'Ahmed Mohamed' },
      { id: 'HR-EMP-00007', name: 'Sara Ali' },
      { id: 'HR-EMP-00008', name: 'Mohamed Hassan' }
    ]

    const colors = ['#ef4444', '#3b82f6', '#10b981']

    // Create legend
    const legend = document.getElementById('legend')
    legend.innerHTML = '<strong>الموظفين:</strong> ' + 
      employees.map((emp, i) => 
        `<span class="legend-item">
          <span class="legend-color" style="background:${colors[i]}"></span>
          ${emp.name}
        </span>`
      ).join('')

    // Initialize viewer
    const viewer = new MultiEmployeeViewer('map')
    viewer.init(
      employees,
      'https://base.meena.sa',
      'YOUR_AUTH_TOKEN'
    )
  </script>
</body>
</html>
```

---

## 🎨 React Implementation

```jsx
import React, { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const AdminLocationViewer = ({ apiUrl, authToken }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const polylineRef = useRef(null)
  const intervalRef = useRef(null)

  const [employee, setEmployee] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [stats, setStats] = useState({
    points: 0,
    distance: 0,
    duration: '',
    lastUpdate: ''
  })

  useEffect(() => {
    // Initialize map
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([31.2344576, 30.0056576], 13)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapInstanceRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const startTracking = async () => {
    if (!employee) {
      alert('اختر موظف أولاً')
      return
    }

    setIsTracking(true)
    await updateLocations()

    // Update every 10 seconds
    intervalRef.current = setInterval(async () => {
      await updateLocations()
    }, 10000)
  }

  const stopTracking = () => {
    setIsTracking(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const updateLocations = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
        `employee=${employee}&date=${today}`,
        {
          headers: { 'Authorization': `token ${authToken}` }
        }
      )

      const data = await response.json()
      const locations = data.message || []

      if (locations.length === 0) return

      // Update polyline
      const coordinates = locations.map(loc => [loc.latitude, loc.longitude])
      
      if (polylineRef.current) {
        mapInstanceRef.current.removeLayer(polylineRef.current)
      }
      
      polylineRef.current = L.polyline(coordinates, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7
      }).addTo(mapInstanceRef.current)

      // Update marker
      const lastLocation = locations[locations.length - 1]
      
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current)
      }

      const pulsingIcon = L.divIcon({
        className: 'pulsing-marker',
        html: '<div class="pulse">📍</div>',
        iconSize: [30, 30]
      })

      markerRef.current = L.marker(
        [lastLocation.latitude, lastLocation.longitude],
        { icon: pulsingIcon }
      ).addTo(mapInstanceRef.current)

      markerRef.current.bindPopup(`
        <strong>الموقع الحالي</strong><br>
        ${lastLocation.address || 'جاري التحديد...'}
      `).openPopup()

      // Center map
      mapInstanceRef.current.setView([lastLocation.latitude, lastLocation.longitude], 15)

      // Update stats
      updateStats(locations)

    } catch (error) {
      console.error('Failed to update:', error)
    }
  }

  const updateStats = (locations) => {
    // Calculate distance
    let distance = 0
    for (let i = 1; i < locations.length; i++) {
      distance += calculateDistance(
        locations[i-1].latitude, locations[i-1].longitude,
        locations[i].latitude, locations[i].longitude
      )
    }

    // Calculate duration
    const firstTime = new Date(locations[0].log_datetime)
    const lastTime = new Date(locations[locations.length - 1].log_datetime)
    const durationMs = lastTime - firstTime
    const hours = Math.floor(durationMs / 3600000)
    const minutes = Math.floor((durationMs % 3600000) / 60000)

    setStats({
      points: locations.length,
      distance: distance.toFixed(2),
      duration: `${hours}س ${minutes}د`,
      lastUpdate: new Date(locations[locations.length - 1].log_datetime).toLocaleTimeString('ar-EG')
    })
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  return (
    <div className="admin-viewer">
      <div className="header">
        <h1>🗺️ تتبع الموظفين - لوحة التحكم</h1>
        
        <div className="controls">
          <select 
            value={employee} 
            onChange={(e) => setEmployee(e.target.value)}
            disabled={isTracking}
          >
            <option value="">اختر موظف...</option>
            <option value="HR-EMP-00006">Ahmed Mohamed</option>
            <option value="HR-EMP-00007">Sara Ali</option>
          </select>

          {!isTracking ? (
            <button onClick={startTracking} className="btn-primary">
              🔴 بدء التتبع المباشر
            </button>
          ) : (
            <button onClick={stopTracking} className="btn-danger">
              ⏹️ إيقاف
            </button>
          )}
        </div>
      </div>

      {isTracking && (
        <div className="stats">
          <div className="stat-card">
            <div className="stat-value">{stats.points}</div>
            <div className="stat-label">نقاط التتبع</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.distance} كم</div>
            <div className="stat-label">المسافة</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.duration}</div>
            <div className="stat-label">المدة</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.lastUpdate}</div>
            <div className="stat-label">آخر تحديث</div>
          </div>
        </div>
      )}

      <div ref={mapRef} className="map" style={{ height: '600px' }}></div>

      <style jsx>{`
        .admin-viewer {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .header {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .controls {
          margin-top: 15px;
        }
        select, button {
          padding: 10px 20px;
          margin-right: 10px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
          cursor: pointer;
        }
        .btn-danger {
          background: #ef4444;
          color: white;
          cursor: pointer;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 5px;
        }
        .map {
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  )
}

export default AdminLocationViewer
```

---

## 🎯 Vue.js Implementation

```vue
<template>
  <div class="admin-viewer">
    <div class="header">
      <h1>🗺️ تتبع الموظفين المباشر</h1>
      
      <div class="controls">
        <select v-model="selectedEmployee" :disabled="isTracking">
          <option value="">اختر موظف...</option>
          <option value="HR-EMP-00006">Ahmed Mohamed</option>
          <option value="HR-EMP-00007">Sara Ali</option>
        </select>

        <button v-if="!isTracking" @click="startTracking" class="btn-primary">
          🔴 بدء التتبع
        </button>
        <button v-else @click="stopTracking" class="btn-danger">
          ⏹️ إيقاف
        </button>
      </div>
    </div>

    <div v-if="isTracking" class="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.points }}</div>
        <div class="stat-label">نقاط</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.distance }} كم</div>
        <div class="stat-label">المسافة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.duration }}</div>
        <div class="stat-label">المدة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.lastUpdate }}</div>
        <div class="stat-label">آخر تحديث</div>
      </div>
    </div>

    <div ref="mapContainer" class="map"></div>
  </div>
</template>

<script>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default {
  name: 'AdminLocationViewer',
  
  props: {
    apiUrl: String,
    authToken: String
  },

  data() {
    return {
      selectedEmployee: '',
      isTracking: false,
      map: null,
      marker: null,
      polyline: null,
      updateInterval: null,
      stats: {
        points: 0,
        distance: 0,
        duration: '',
        lastUpdate: ''
      }
    }
  },

  mounted() {
    this.initMap()
  },

  beforeUnmount() {
    this.stopTracking()
  },

  methods: {
    initMap() {
      this.map = L.map(this.$refs.mapContainer).setView([31.2344576, 30.0056576], 13)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map)
    },

    async startTracking() {
      if (!this.selectedEmployee) {
        alert('اختر موظف أولاً')
        return
      }

      this.isTracking = true
      await this.updateLocations()

      this.updateInterval = setInterval(() => {
        this.updateLocations()
      }, 10000)
    },

    stopTracking() {
      this.isTracking = false
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
      }
    },

    async updateLocations() {
      try {
        const today = new Date().toISOString().split('T')[0]
        
        const response = await fetch(
          `${this.apiUrl}/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations?` +
          `employee=${this.selectedEmployee}&date=${today}`,
          {
            headers: { 'Authorization': `token ${this.authToken}` }
          }
        )

        const data = await response.json()
        const locations = data.message || []

        if (locations.length === 0) return

        this.drawLocations(locations)
        this.updateStats(locations)

      } catch (error) {
        console.error('Failed to update:', error)
      }
    },

    drawLocations(locations) {
      // Update polyline
      const coordinates = locations.map(loc => [loc.latitude, loc.longitude])
      
      if (this.polyline) {
        this.map.removeLayer(this.polyline)
      }
      
      this.polyline = L.polyline(coordinates, {
        color: '#3b82f6',
        weight: 3
      }).addTo(this.map)

      // Update marker
      const lastLocation = locations[locations.length - 1]
      
      if (this.marker) {
        this.map.removeLayer(this.marker)
      }

      this.marker = L.marker([lastLocation.latitude, lastLocation.longitude])
        .addTo(this.map)
        .bindPopup(`
          <strong>الموقع الحالي</strong><br>
          ${lastLocation.address || 'جاري التحديد...'}
        `)
        .openPopup()

      this.map.setView([lastLocation.latitude, lastLocation.longitude], 15)
    },

    updateStats(locations) {
      let distance = 0
      for (let i = 1; i < locations.length; i++) {
        distance += this.calculateDistance(
          locations[i-1].latitude, locations[i-1].longitude,
          locations[i].latitude, locations[i].longitude
        )
      }

      const firstTime = new Date(locations[0].log_datetime)
      const lastTime = new Date(locations[locations.length - 1].log_datetime)
      const durationMs = lastTime - firstTime
      const hours = Math.floor(durationMs / 3600000)
      const minutes = Math.floor((durationMs % 3600000) / 60000)

      this.stats = {
        points: locations.length,
        distance: distance.toFixed(2),
        duration: `${hours}س ${minutes}د`,
        lastUpdate: new Date(locations[locations.length - 1].log_datetime).toLocaleTimeString('ar-EG')
      }
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      return R * c
    }
  }
}
</script>

<style scoped>
.admin-viewer {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.controls {
  margin-top: 15px;
}

select, button {
  padding: 10px 20px;
  margin-right: 10px;
  border: none;
  border-radius: 6px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.map {
  height: 600px;
  border-radius: 8px;
}
</style>
```

---

## 🎉 Summary

### Quick Reference

**للمشاهدة المباشرة (Real-Time):**
```javascript
// 1. Initialize tracker
const tracker = new RealTimeEmployeeTracker('map')

// 2. Start tracking
tracker.init(employee, apiUrl, authToken)

// 3. Updates every 10 seconds automatically
```

**لعرض عدة موظفين:**
```javascript
const viewer = new MultiEmployeeViewer('map')
viewer.init(employees, apiUrl, authToken)
```

**المميزات:**
- ✅ تحديث تلقائي كل 10-15 ثانية
- ✅ Marker نابض يتحرك مع الموظف
- ✅ خط أزرق يظهر المسار الكامل
- ✅ إحصائيات مباشرة (مسافة، وقت، سرعة)
- ✅ Pop-ups تفاعلية
- ✅ دعم عدة موظفين بألوان مختلفة

---

**🎯 الآن لديك كل ما تحتاجه لبناء لوحة تحكم إدارية كاملة لمشاهدة الموظفين!**
