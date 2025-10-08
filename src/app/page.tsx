"use client"

import React, { useEffect, useRef, useState } from "react"
import maplibregl, { Map } from "maplibre-gl"
import { MapboxOverlay } from "@deck.gl/mapbox"
import { ScatterplotLayer } from "@deck.gl/layers"
import "maplibre-gl/dist/maplibre-gl.css"

interface PointData {
  id: number
  lng: number
  lat: number
  value: number
}

function generateRandomPoints(count: number, bbox = [94.9, -10.0, 139.0, 4.5]): PointData[] {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    lng: minLng + Math.random() * (maxLng - minLng),
    lat: minLat + Math.random() * (maxLat - minLat),
    value: Math.random(),
  }))
}

export default function RealtimeMapDemo() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [data, setData] = useState<PointData[]>(() => generateRandomPoints(50000))

  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "google-tiles": {
            type: "raster",
            tiles: [
              "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
            attribution: "&copy; <a href='https://www.google.com/'>Google Maps</a>",
          },
        },
        layers: [
          {
            id: "google-base",
            type: "raster",
            source: "google-tiles",
          },
        ],
      },
      center: [106.8, -6.2],
      zoom: 11,
      // ;(antialias as any): true,
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
            getPosition: (d: PointData) => [d.lng, d.lat],
            getFillColor: (d: PointData) => [0, 200 * d.value, 255 - 200 * d.value],
            getRadius: 20,
            radiusMinPixels: 1,
            radiusMaxPixels: 30,
            pickable: false,
          }),
        ],
      })

      map.addControl(overlay as any)
      overlayRef.current = overlay

      const gl = (map as any).painter.context.gl
      gl.clearColor(0, 0, 0, 0)
    })

    return () => {
      map.remove()
      overlayRef.current = null
    }
  }, [])

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

  useEffect(() => {
    if (!overlayRef.current) return

    const layer = new ScatterplotLayer({
      id: "gps-points",
      data,
      getPosition: (d: PointData) => [d.lng, d.lat],
      getFillColor: (d: PointData) => [0, 200 * d.value, 255 - 200 * d.value],
      getRadius: 20,
      radiusMinPixels: 1,
      radiusMaxPixels: 30,
      pickable: false,
    })

    overlayRef.current.setProps({ layers: [layer] })
  }, [data])

  return (
    <div
      className="min-h-screen"
      style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          width: "100%",
          height: "100vh",
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
    </div>
  )
}
