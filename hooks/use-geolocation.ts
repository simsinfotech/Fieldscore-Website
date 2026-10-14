"use client"

import { useState, useCallback } from "react"

interface GeolocationState {
  lat: number | null
  lng: number | null
  address: string | null
  loading: boolean
  error: string | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    address: null,
    loading: false,
    error: null,
  })

  const getLocation = useCallback((): Promise<{ lat: number; lng: number; address: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = "Geolocation is not supported by your browser"
        setState((prev) => ({ ...prev, error: err }))
        reject(new Error(err))
        return
      }

      setState((prev) => ({ ...prev, loading: true, error: null }))

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords
          let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`

          // Reverse geocode
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            )
            const data = await res.json()
            if (data.display_name) {
              address = data.display_name
            }
          } catch {
            // Use coords as fallback
          }

          setState({ lat, lng, address, loading: false, error: null })
          resolve({ lat, lng, address })
        },
        (err) => {
          const errorMsg =
            err.code === 1
              ? "Location permission denied. Please enable GPS."
              : err.code === 2
              ? "Position unavailable. Please try again."
              : "Location request timed out."
          setState((prev) => ({ ...prev, loading: false, error: errorMsg }))
          reject(new Error(errorMsg))
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })
  }, [])

  return { ...state, getLocation }
}
