"use client"

import React, { useEffect, useRef, useState } from "react"
import maplibregl, { Map } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

type LatLng = { lat: number; lng: number }
type SamplePoint = { lat: number; lng: number; distanceFromStart: number; bearing?: number }

const DEFAULT_BBOX: [number, number, number, number] = [106.727, -6.353, 106.987, -6.127] // Jakarta area

/* --- Geodesy helpers --- */
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

function destinationPoint(start: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const R = 6378137
  const φ1 = toRad(start.lat)
  const λ1 = toRad(start.lng)
  const θ = toRad(bearingDeg)
  const δ = distanceM / R

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    )

  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 }
}

function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6378137
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const φ1 = toRad(a.lat)
  const φ2 = toRad(b.lat)
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
}

function bearingDeg(a: LatLng, b: LatLng) {
  const φ1 = toRad(a.lat)
  const φ2 = toRad(b.lat)
  const λ1 = toRad(a.lng)
  const λ2 = toRad(b.lng)
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  const θ = Math.atan2(y, x)
  return (toDeg(θ) + 360) % 360
}

function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

/* --- Sample line every X meters --- */
function sampleLine(coords: [number, number][], intervalM = 10): SamplePoint[] {
  if (!coords || coords.length < 2) return []
  const pts: SamplePoint[] = []
  let accumulated = 0
  let prev = { lat: coords[0][1], lng: coords[0][0] }
  pts.push({ ...prev, distanceFromStart: 0 })

  for (let i = 1; i < coords.length; i++) {
    const cur = { lat: coords[i][1], lng: coords[i][0] }
    const segLen = distanceMeters(prev, cur)
    if (segLen === 0) continue

    let dist = 0
    while (dist + intervalM <= segLen) {
      dist += intervalM
      const t = dist / segLen
      const p = lerpLatLng(prev, cur, t)
      accumulated += intervalM
      pts.push({ ...p, distanceFromStart: accumulated })
    }
    prev = cur
  }

  for (let i = 0; i < pts.length - 1; i++) {
    pts[i].bearing = bearingDeg(pts[i], pts[i + 1])
  }
  pts[pts.length - 1].bearing = pts[pts.length - 2]?.bearing ?? 0
  return pts
}

/* --- Helpers --- */
function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function generateTwoPointsDistanceApprox(bbox: [number, number, number, number], targetDistanceMeters = 5000) {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const start = { lng: randomBetween(minLng, maxLng), lat: randomBetween(minLat, maxLat) }
  const bearing = Math.random() * 360
  const end = destinationPoint(start, bearing, targetDistanceMeters)
  return { start, end }
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/* --- Component --- */
export default function RouteAnimationMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const samplesRef = useRef<SamplePoint[]>([])
  const startTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [status, setStatus] = useState("init")
  const [routeInfo, setRouteInfo] = useState<{ distance?: number; duration?: number } | null>(null)

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
      zoom: 12,
      attributionControl: false,
    })
    mapRef.current = map

    map.on("load", () => {
      const markerEl = document.createElement("div")
      markerEl.className = "vehicle-marker"
      markerEl.style.width = "40px"
      markerEl.style.height = "40px"
      markerEl.style.display = "flex"
      markerEl.style.justifyContent = "center"
      markerEl.style.alignItems = "center"
      markerEl.style.pointerEvents = "none"

      const innerEl = document.createElement("div")
      innerEl.className = "vehicle-rotation"
      innerEl.innerHTML = `
        <svg viewBox="0 0 40 40" width="40" height="40">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.25"/>
            </filter>
          </defs>
          <circle cx="20" cy="22" r="10" fill="#1E90FF" filter="url(#shadow)" />
          <polygon points="20,6 14,18 26,18" fill="#ffffff" opacity="0.95"/>
        </svg>
      `
      markerEl.appendChild(innerEl)

      markerRef.current = new maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([0, 0])
        .addTo(map)
    })

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (markerRef.current) markerRef.current.remove()
      map.remove()
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function runAll() {
      setStatus("generating points")
      const { start, end } = generateTwoPointsDistanceApprox(DEFAULT_BBOX, 5000)
      if (isCancelled) return

      mapRef.current?.flyTo({ center: [start.lng, start.lat], zoom: 13, speed: 0.6 })
      setStatus("fetching route")

      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const json = await res.json()

      if (!json.routes?.length) return setStatus("no route")

      const route = json.routes[0]
      const coords: [number, number][] = route.geometry.coordinates
      const totalDistance = route.distance
      const totalDuration = route.duration
      setRouteInfo({ distance: totalDistance, duration: totalDuration })

      const samples = sampleLine(coords, 10)
      samplesRef.current = samples
      if (!samples.length) return

      const first = samples[0]
      const el = markerRef.current?.getElement() as HTMLElement
      const inner = el?.querySelector(".vehicle-rotation") as HTMLElement
      markerRef.current?.setLngLat([first.lng, first.lat])
      if (inner) inner.style.transform = `rotate(${first.bearing ?? 0}deg)`

      setStatus("animating")
      const durationMs = Math.max(1000, Math.round(totalDuration * 1000))
      startTimeRef.current = performance.now()
      const totalLen = samples[samples.length - 1].distanceFromStart

      const animate = (timeNow: number) => {
        if (!startTimeRef.current) startTimeRef.current = timeNow
        const t = (timeNow - startTimeRef.current) / durationMs
        const eased = Math.min(1, Math.max(0, easeInOutQuad(t)))
        const targetDistance = eased * totalLen

        let i = 0
        while (i < samples.length - 1 && samples[i + 1].distanceFromStart < targetDistance) i++
        const a = samples[i]
        const b = samples[Math.min(i + 1, samples.length - 1)]
        const segLen = Math.max(1e-6, b.distanceFromStart - a.distanceFromStart)
        const localT = (targetDistance - a.distanceFromStart) / segLen
        const pos = lerpLatLng(a, b, localT)
        const bearing = a.bearing ?? bearingDeg(a, b)

        markerRef.current?.setLngLat([pos.lng, pos.lat])
        const el = markerRef.current?.getElement() as HTMLElement
        const inner = el?.querySelector(".vehicle-rotation") as HTMLElement
        if (inner) inner.style.transform = `rotate(${bearing}deg)`

        if (eased < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          setStatus("finished")
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    runAll()
    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <div className="relative h-screen w-full bg-gray-100 dark:bg-gray-900 transition-colors duration-500">
      <div className="absolute z-10 left-3 top-3 p-3 rounded-xl bg-white/90 dark:bg-gray-800/80 shadow-lg">
        <div className="font-bold text-gray-900 dark:text-gray-100">Route Animation</div>
        <div className="text-gray-800 dark:text-gray-200 text-sm">Status: {status}</div>
        <div className="text-gray-800 dark:text-gray-200 text-sm">
          Distance: {routeInfo?.distance ? Math.round(routeInfo.distance) + " m" : "-"} •{" "}
          Duration: {routeInfo?.duration ? Math.round(routeInfo.duration) + " s" : "-"}
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="h-full w-full transition-all duration-500 dark:invert dark:hue-rotate-180 dark:brightness-90 dark:contrast-120"
      />
    </div>
  )
}
