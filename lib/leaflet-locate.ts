import L from 'leaflet'

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>'

/**
 * «موقعي الحالي» button (Google-Maps style) for a Leaflet map: centres on the
 * browser's position and draws the blue dot with its accuracy ring. The dot is
 * not interactive, so a click on it still reaches the map (and places the pin
 * in the pickers). Geolocation needs HTTPS and the visitor's permission.
 */
export function addLocateControl(map: L.Map): void {
  let dot: L.CircleMarker | null = null
  let ring: L.Circle | null = null

  const Locate = L.Control.extend({
    options: { position: 'topleft' as L.ControlPosition },
    onAdd() {
      const bar = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
      const btn = L.DomUtil.create('a', '', bar) as HTMLAnchorElement
      btn.href = '#'
      btn.setAttribute('role', 'button')
      btn.title = 'موقعي الحالي'
      btn.setAttribute('aria-label', 'موقعي الحالي')
      btn.innerHTML = ICON
      btn.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#1d4d56'
      L.DomEvent.disableClickPropagation(bar)
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e)
        if (!navigator.geolocation) {
          btn.title = 'المتصفح لا يدعم تحديد الموقع'
          return
        }
        btn.style.color = '#1a73e8'
        btn.style.opacity = '0.6'
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btn.style.opacity = '1'
            btn.title = 'موقعي الحالي'
            const ll = L.latLng(pos.coords.latitude, pos.coords.longitude)
            ring?.remove()
            dot?.remove()
            ring = L.circle(ll, {
              radius: pos.coords.accuracy || 30, color: '#1a73e8', weight: 1, fillColor: '#1a73e8',
              fillOpacity: 0.1, interactive: false,
            }).addTo(map)
            dot = L.circleMarker(ll, {
              radius: 7, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1, interactive: false,
            }).addTo(map)
            map.flyTo(ll, Math.max(map.getZoom(), 17))
          },
          () => {
            btn.style.opacity = '1'
            btn.style.color = '#dc2626'
            btn.title = 'تعذّر تحديد موقعك — اسمح للمتصفح بالوصول إلى الموقع'
            setTimeout(() => { btn.style.color = '#1d4d56' }, 3000)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        )
      })
      return bar
    },
  })
  new Locate().addTo(map)
}
