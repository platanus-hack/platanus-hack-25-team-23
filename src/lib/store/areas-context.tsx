"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { DEFAULT_AREAS, DEFAULT_YOU_NODE_COLOR, AreaConfig } from '@/lib/data/areas-config'

interface AreasContextType {
  areas: AreaConfig[]
  youNodeColor: string
  setYouNodeColor: (color: string) => void
  updateArea: (id: string, updates: Partial<AreaConfig>) => void
  deleteArea: (id: string) => void
  addArea: (area: AreaConfig) => void
  resetAreas: () => void
  getColorForDepth: (baseColor: string, depth: number) => string
}

const AreasContext = createContext<AreasContextType | undefined>(undefined)

// Generate color variants based on depth (0 = area, 1 = topic, 2 = subtopic, 3+ = notes)
function getColorForDepth(baseColor: string, depth: number): string {
  // Parse hex color
  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate alpha/opacity based on depth
  // Depth 0 (area): 100% opacity
  // Depth 1 (topic): 70% opacity
  // Depth 2 (subtopic): 50% opacity
  // Depth 3+ (notes): 35% opacity
  const alphaMap: Record<number, number> = {
    0: 1.0,    // Area - solid
    1: 0.7,    // Topic - slightly lighter
    2: 0.5,    // Subtopic - lighter
    3: 0.35,   // Notes - lightest
  }

  const alpha = alphaMap[Math.min(depth, 3)]

  // Blend with white to create lighter versions
  const blend = (c: number, a: number) => Math.round(c * a + 255 * (1 - a))

  const newR = blend(r, alpha)
  const newG = blend(g, alpha)
  const newB = blend(b, alpha)

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

// Generate color variants for an area (from solid to light)
function generateColorVariants(baseColor: string): string[] {
  return [
    getColorForDepth(baseColor, 0), // Solid (area)
    getColorForDepth(baseColor, 1), // Topic
    getColorForDepth(baseColor, 2), // Subtopic
    getColorForDepth(baseColor, 3), // Notes
  ]
}

export function AreasProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<AreaConfig[]>(DEFAULT_AREAS)
  const [youNodeColor, setYouNodeColorState] = useState(DEFAULT_YOU_NODE_COLOR)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const savedAreas = localStorage.getItem('brainflow_areas')
    const savedYouColor = localStorage.getItem('brainflow_you_color')
    const areasVersion = localStorage.getItem('brainflow_areas_version')

    // Version 3 = dynamic color variants generation
    const CURRENT_VERSION = '3'

    if (savedAreas && areasVersion === CURRENT_VERSION) {
      try {
        const parsed = JSON.parse(savedAreas) as AreaConfig[]
        // Regenerate color variants to ensure they match the current base color
        const updatedAreas = parsed.map(area => ({
          ...area,
          colorVariants: generateColorVariants(area.color)
        }))
        setAreas(updatedAreas)
      } catch (e) {
        console.error('Error loading areas:', e)
      }
    } else {
      // Use DEFAULT_AREAS with new pastel colors (migration or first load)
      const areasWithVariants = DEFAULT_AREAS.map(area => ({
        ...area,
        colorVariants: generateColorVariants(area.color)
      }))
      setAreas(areasWithVariants)
      // Save new version
      localStorage.setItem('brainflow_areas_version', CURRENT_VERSION)
    }

    if (savedYouColor) {
      setYouNodeColorState(savedYouColor)
    }
  }, [])

  // Save to localStorage when areas change
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('brainflow_areas', JSON.stringify(areas))
  }, [areas, mounted])

  // Save youNodeColor to localStorage
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('brainflow_you_color', youNodeColor)
  }, [youNodeColor, mounted])

  const setYouNodeColor = useCallback((color: string) => {
    setYouNodeColorState(color)
  }, [])

  const updateArea = useCallback((id: string, updates: Partial<AreaConfig>) => {
    setAreas(prev => prev.map(area => {
      if (area.id === id) {
        const updated = { ...area, ...updates }
        // Regenerate color variants if color changed
        if (updates.color) {
          updated.colorVariants = generateColorVariants(updates.color)
        }
        return updated
      }
      return area
    }))
  }, [])

  const deleteArea = useCallback((id: string) => {
    setAreas(prev => prev.filter(area => area.id !== id))
  }, [])

  const addArea = useCallback((area: AreaConfig) => {
    // Generate color variants
    const areaWithVariants = {
      ...area,
      colorVariants: generateColorVariants(area.color)
    }
    setAreas(prev => [...prev, areaWithVariants])
  }, [])

  const resetAreas = useCallback(() => {
    setAreas(DEFAULT_AREAS)
    setYouNodeColorState(DEFAULT_YOU_NODE_COLOR)
  }, [])

  const value = {
    areas,
    youNodeColor,
    setYouNodeColor,
    updateArea,
    deleteArea,
    addArea,
    resetAreas,
    getColorForDepth,
  }

  return (
    <AreasContext.Provider value={value}>
      {children}
    </AreasContext.Provider>
  )
}

export function useAreas() {
  const context = useContext(AreasContext)
  if (context === undefined) {
    throw new Error('useAreas must be used within an AreasProvider')
  }
  return context
}
