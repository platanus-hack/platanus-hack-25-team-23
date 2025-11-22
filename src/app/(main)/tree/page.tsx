"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { ChevronRight, ChevronDown, CheckCircle, Clock, Circle } from "lucide-react"
import Link from 'next/link'

interface TreeNode {
  id: string
  name: string
  status: string
  area: string
  areaColor?: string
  level: string
  children: TreeNode[]
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
}

export default function TreePage() {
  const { notes, session } = useKnowledge()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['yo']))
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTreeData() {
      if (!session?.user) {
        // Demo mode: build tree from context notes
        const demoTree: TreeNode[] = [{
          id: 'yo',
          name: 'Yo',
          status: 'understood',
          area: '',
          level: 'intermediate',
          children: notes.map(note => ({
            id: note.slug,
            name: note.title,
            status: note.status === 'understood' ? 'understood' : note.status === 'read' ? 'in-progress' : 'pending',
            area: 'General',
            level: 'intermediate',
            children: []
          }))
        }]
        setTree(demoTree)
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Load areas
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)

      if (areasData) {
        setAreas(areasData)
      }

      // Load concepts with areas
      const { data: concepts } = await supabase
        .from('concepts')
        .select('*, areas(name, color)')
        .eq('user_id', session.user.id)

      // Load relationships
      const { data: relationships } = await supabase
        .from('concept_relationships')
        .select('*')
        .eq('user_id', session.user.id)

      // Build tree structure
      const nodeMap = new Map<string, TreeNode>()

      // Add root "Yo" node
      nodeMap.set('yo', {
        id: 'yo',
        name: 'Yo',
        status: 'understood',
        area: '',
        level: 'intermediate',
        children: []
      })

      // Add area nodes
      if (areasData) {
        areasData.forEach(area => {
          nodeMap.set(`area-${area.id}`, {
            id: `area-${area.id}`,
            name: area.name,
            status: 'understood',
            area: area.name,
            areaColor: area.color,
            level: 'intermediate',
            children: []
          })
          // Link areas to "Yo"
          nodeMap.get('yo')!.children.push(nodeMap.get(`area-${area.id}`)!)
        })
      }

      // Add concept nodes
      if (concepts) {
        concepts.forEach(concept => {
          nodeMap.set(concept.id, {
            id: concept.id,
            name: concept.name,
            status: concept.status || 'pending',
            area: (concept.areas as any)?.name || 'General',
            areaColor: (concept.areas as any)?.color || '#C9B7F3',
            level: concept.level || 'intermediate',
            children: []
          })

          // Link concepts to their area
          if (concept.area_id) {
            const areaNode = nodeMap.get(`area-${concept.area_id}`)
            if (areaNode) {
              areaNode.children.push(nodeMap.get(concept.id)!)
            }
          }
        })
      }

      // Add relationships between concepts
      if (relationships) {
        relationships.forEach(rel => {
          const parent = nodeMap.get(rel.source_concept_id)
          const child = nodeMap.get(rel.target_concept_id)
          if (parent && child && !parent.children.includes(child)) {
            parent.children.push(child)
          }
        })
      }

      const root = nodeMap.get('yo')
      setTree(root ? [root] : [])
      setLoading(false)
    }

    loadTreeData()
  }, [session, notes])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'understood':
        return <CheckCircle className="size-5 text-green-500" />
      case 'in-progress':
        return <Clock className="size-5 text-yellow-500" />
      default:
        return <Circle className="size-5 text-gray-300" />
    }
  }

  const getAreaColor = (areaName: string, node?: TreeNode) => {
    if (node?.areaColor) return node.areaColor
    const area = areas.find(a => a.name === areaName)
    return area?.color || '#C9B7F3'
  }

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children.length > 0
    const isYouNode = node.id === 'yo'
    const isAreaNode = node.id.startsWith('area-')

    // Filter by selected area
    if (selectedArea && !isYouNode && !isAreaNode) {
      if (node.area !== selectedArea) return null
    }

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-3 py-3 px-4 rounded-xl cursor-pointer transition-colors ${
            isYouNode ? 'bg-purple-100' :
            isAreaNode ? 'bg-gray-100' :
            'hover:bg-gray-50'
          }`}
          style={{ marginLeft: depth * 24 }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button className="w-6 h-6 flex items-center justify-center text-gray-400">
              {isExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Status Icon or Area Color */}
          {isYouNode ? (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-lg">
              Yo
            </div>
          ) : isAreaNode ? (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: getAreaColor(node.area, node) }}
            >
              {areas.find(a => a.name === node.name)?.icon || '📚'}
            </div>
          ) : (
            getStatusIcon(node.status)
          )}

          {/* Node Name */}
          <div className="flex-1">
            <span className={`font-medium ${isYouNode || isAreaNode ? 'text-gray-900' : 'text-gray-700'}`}>
              {node.name}
            </span>
            {!isYouNode && !isAreaNode && (
              <span className="ml-2 text-xs text-gray-400 capitalize">{node.level}</span>
            )}
          </div>

          {/* Area Badge */}
          {!isYouNode && !isAreaNode && (
            <div
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: getAreaColor(node.area, node) + '30',
                color: getAreaColor(node.area, node)
              }}
            >
              {node.area.split(' ')[0]}
            </div>
          )}

          {/* Study Link */}
          {!isYouNode && !isAreaNode && (
            <Link
              href={`/study?topic=${encodeURIComponent(node.name)}`}
              className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Estudiar
            </Link>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l-2 border-gray-200">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ruta de Aprendizaje</h1>
          <p className="text-gray-600">Explora tu camino de conocimiento</p>
        </div>

        {/* Area Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedArea(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedArea === null
                ? 'bg-purple-100 text-purple-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas las areas
          </button>
          {areas.map(area => (
            <button
              key={area.id}
              onClick={() => setSelectedArea(area.name)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedArea === area.name
                  ? 'text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              style={{
                backgroundColor: selectedArea === area.name ? area.color : undefined
              }}
            >
              {area.icon || '📚'} {area.name}
            </button>
          ))}
        </div>

        {/* Tree View */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
          {tree.map(node => renderTreeNode(node))}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-xl p-4 shadow-soft border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Estado de los conceptos</h4>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              <span className="text-sm text-gray-600">Dominado</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-yellow-500" />
              <span className="text-sm text-gray-600">En progreso</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="size-5 text-gray-300" />
              <span className="text-sm text-gray-600">Pendiente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
