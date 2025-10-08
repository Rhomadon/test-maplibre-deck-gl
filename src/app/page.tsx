"use client"

import React, { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import { MapboxOverlay } from "@deck.gl/mapbox"
import { ScatterplotLayer } from "@deck.gl/layers"
import "maplibre-gl/dist/maplibre-gl.css"

function generateRandomPoints(count: number, bbox = [106.6, -6.4, 107.0, -6.0]) {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    lng: minLng + Math.random() * (maxLng - minLng),
    lat: minLat + Math.random() * (maxLat - minLat),
    value: Math.random(),
  }))
}

export default function RealtimeMapDemo(): JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [data, setData] = useState(() => generateRandomPoints(50000))
  const [isMounted, setIsMounted] = useState(false)

  // Inisialisasi MapLibre dan Deck.GL overlay
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [106.8, -6.2],
      zoom: 11,
      antialias: true,
      attributionControl: false,
    })

    mapRef.current = map

    map.on("load", () => {
      const overlay = new MapboxOverlay({
        interleaved: true,
        layers: [
          new ScatterplotLayer({
            id: "gps-points",
            data,
            getPosition: (d: any) => [d.lng, d.lat],
            getFillColor: (d: any) => [0, 200 * d.value, 255 - 200 * d.value],
            getRadius: 20,
            radiusMinPixels: 1,
            radiusMaxPixels: 30,
            pickable: false,
            updateTriggers: {
              getPosition: [data],
            },
          }),
        ],
      })

      // Pastikan background transparan
      const gl = (map as any).painter.context.gl
      gl.clearColor(0, 0, 0, 0)

      map.addControl(overlay as any)
      overlayRef.current = overlay
    })

    return () => map.remove()
  }, [])

  // Update data secara halus (tanpa kedipan)
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev =>
        prev.map(p => ({
          ...p,
          lng: p.lng + (Math.random() - 0.5) * 0.0003,
          lat: p.lat + (Math.random() - 0.5) * 0.0003,
        }))
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Update layer tanpa membuat ulang overlay
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const layer = new ScatterplotLayer({
      id: "gps-points",
      data,
      getPosition: (d: any) => [d.lng, d.lat],
      getFillColor: (d: any) => [0, 200 * d.value, 255 - 200 * d.value],
      getRadius: 20,
      radiusMinPixels: 1,
      radiusMaxPixels: 30,
      pickable: false,
    })

    overlay.setProps({ layers: [layer] })
  }, [data])

  // Hindari hydration mismatch
  useEffect(() => setIsMounted(true), [])

  const samplePolyline = data.slice(0, 1000).map(p => [p.lat, p.lng])

  return (
    <div
      className="min-h-screen p-4"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
    >
      {/* MAPLIBRE + DECK.GL */}
      <div
        style={{
          height: "80vh",
          borderRadius: 8,
          overflow: "hidden",
          background: "transparent",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        }}
      >
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        />
      </div>

      {/* LEAFLET PREVIEW */}
      <div
        style={{
          height: "80vh",
          borderRadius: 8,
          overflow: "hidden",
          background: "transparent",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        }}
      >
        {isMounted && (
          <iframe
            title="leaflet-demo"
            style={{
              border: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
            }}
            srcDoc={`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html,body,#map{height:100%;margin:0;background:transparent}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([-6.2,106.8],11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, opacity:0.8}).addTo(map);
    const pts = ${JSON.stringify(samplePolyline)};
    L.polyline(pts, {color: 'blue', weight: 2}).addTo(map);
  </script>
</body>
</html>`}
          />
        )}
      </div>
    </div>
  )
}
