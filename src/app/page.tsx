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
  targetLng?: number
  targetLat?: number
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

function getRandomTarget(lng: number, lat: number, distanceMeters = 100) {
  const earthRadius = 6378137
  const dLat = (Math.random() - 0.5) * (distanceMeters / earthRadius) * 2
  const dLng =
    (Math.random() - 0.5) *
    (distanceMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) *
    2

  return {
    lng: lng + (dLng * 180) / Math.PI,
    lat: lat + (dLat * 180) / Math.PI,
  }
}

export default function RealtimeMapDemo() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [data, setData] = useState<PointData[]>(() => generateRandomPoints(100000))

  const animationRef = useRef<number | null>(null)
  const lastTargetTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "google-tiles": {
            type: "raster",
            tiles: ["https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"],
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
    const animate = () => {
      const now = performance.now()
      const delta = now - lastTargetTimeRef.current

      if (delta > 1000) {
        setData(prev =>
          prev.map(p => {
            const { lng, lat } = getRandomTarget(p.lng, p.lat, 100)
            return { ...p, targetLng: lng, targetLat: lat }
          })
        )
        lastTargetTimeRef.current = now
      }

      setData(prev =>
        prev.map(p => {
          if (p.targetLng == null || p.targetLat == null) return p
          const lerpFactor = 0.03
          const newLng = p.lng + (p.targetLng - p.lng) * lerpFactor
          const newLat = p.lat + (p.targetLat - p.lat) * lerpFactor
          return { ...p, lng: newLng, lat: newLat }
        })
      )

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
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
      updateTriggers: { getPosition: data },
    })

    overlayRef.current.setProps({ layers: [layer] })
  }, [data])

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="w-full h-screen rounded-lg overflow-hidden shadow-lg bg-transparent">
        <div ref={mapContainerRef} className="w-full h-full bg-transparent" />
      </div>
    </div>
  )
}
