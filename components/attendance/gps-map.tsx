"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"

interface MapPoint {
  lat: number
  lng: number
  label: string
  time?: string
}

interface GpsMapProps {
  points: MapPoint[]
  height?: string
  className?: string
}

function GpsMapInner({ points, height = "400px", className }: GpsMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const L = require("leaflet")

    // Fix default marker icon
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    })

    if (mapRef.current) {
      mapRef.current.remove()
    }

    if (!containerRef.current) return

    const map = L.map(containerRef.current).setView(
      points.length > 0 ? [points[0].lat, points[0].lng] : [20.5937, 78.9629],
      points.length > 0 ? 13 : 5
    )

    // Light tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map)

    points.forEach((p) => {
      L.marker([p.lat, p.lng])
        .addTo(map)
        .bindPopup(`<strong>${p.label}</strong>${p.time ? `<br/>${p.time}` : ""}`)
    })

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [30, 30] })
    }

    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div
        ref={containerRef}
        style={{ height }}
        className={`rounded-lg overflow-hidden ${className ?? ""}`}
      />
    </>
  )
}

// Dynamic import to avoid SSR issues with Leaflet
export const GpsMap = dynamic(() => Promise.resolve(GpsMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-[#0A1628] rounded-lg" style={{ height: "400px" }}>
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
})
