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

function generateRandomPoints(count: number, bbox = [106.6, -6.3, 106.9, -6.0]): PointData[] {
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
  const [data, setData] = useState<PointData[]>(() => generateRandomPoints(100000))

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
      attributionControl: false,
    })

    ;(map as any).antialias = true

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
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="w-full h-screen rounded-lg overflow-hidden shadow-lg shadow-black/20 bg-transparent">
        <div ref={mapContainerRef} className="w-full h-full bg-transparent" />
      </div>
    </div>
  )
}
