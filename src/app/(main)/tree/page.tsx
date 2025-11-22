"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { ChevronRight, ChevronDown, CheckCircle, Clock, Circle, Lightbulb, ArrowRight, Network } from "lucide-react"
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
            areaColor: '#C9B7F3',
            level: 'intermediate',
            children: []
          }))
        }]
        setTree(demoTree)
        setLoading(false)
        return
      }

      const supabase = createClient()

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)

      if (areasData) {
        setAreas(areasData)
      }

      const { data: concepts } = await supabase
        .from('concepts')
        .select('*, areas(name, color)')
        .eq('user_id', session.user.id)

      const { data: relationships } = await supabase
        .from('concept_relationships')
        .select('*')
        .eq('user_id', session.user.id)

      const nodeMap = new Map<string, TreeNode>()

      nodeMap.set('yo', {
        id: 'yo',
        name: 'Yo',
        status: 'understood',
        area: '',
        level: 'intermediate',
        children: []
      })

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
          nodeMap.get('yo')!.children.push(nodeMap.get(`area-${area.id}`)!)
        })
      }

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

          if (concept.area_id) {
            const areaNode = nodeMap.get(`area-${concept.area_id}`)
            if (areaNode) {
              areaNode.children.push(nodeMap.get(concept.id)!)
            }
          }
        })
      }

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
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #A3E4B6 0%, #B9E2B1 100%)',
              boxShadow: '0px 2px 6px rgba(163, 228, 182, 0.3)'
            }}
          >
            <CheckCircle className="size-4 text-white" />
          </div>
        )
      case 'in-progress':
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FFE9A9 0%, #FFF4D4 100%)',
              boxShadow: '0px 2px 6px rgba(255, 233, 169, 0.3)'
            }}
          >
            <Clock className="size-4" style={{ color: '#B89C3C' }} />
          </div>
        )
      default:
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #E6E6E6 0%, #F0F0F0 100%)',
              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)'
            }}
          >
            <Circle className="size-4" style={{ color: '#646464' }} />
          </div>
        )
    }
  }

  const getAreaColor = (areaName: string, node?: TreeNode) => {
    if (node?.areaColor) return node.areaColor
    const area = areas.find(a => a.name === areaName)
    return area?.color || '#C9B7F3'
  }

  // Find next recommended (pending with no pending prerequisites)
  const findNextRecommended = () => {
    const allNodes: TreeNode[] = []
    const collectNodes = (node: TreeNode) => {
      if (!node.id.startsWith('area-') && node.id !== 'yo') {
        allNodes.push(node)
      }
      node.children.forEach(collectNodes)
    }
    tree.forEach(collectNodes)
    return allNodes.find(n => n.status === 'pending')
  }

  const nextRecommended = findNextRecommended()

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children.length > 0
    const isYouNode = node.id === 'yo'
    const isAreaNode = node.id.startsWith('area-')

    if (selectedArea && !isYouNode && !isAreaNode) {
      if (node.area !== selectedArea) return null
    }

    return (
      <div key={node.id} className="select-none">
        <div
          className="flex items-center gap-3 py-4 px-4 rounded-2xl cursor-pointer transition-all duration-200 mb-2 hover:scale-[1.01]"
          style={{
            marginLeft: depth * 28,
            background: isYouNode
              ? 'linear-gradient(135deg, #E6DEF9 0%, #F0EAF9 100%)'
              : isAreaNode
              ? `linear-gradient(135deg, ${getAreaColor(node.area, node)}20 0%, ${getAreaColor(node.area, node)}10 100%)`
              : 'white',
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            border: isYouNode
              ? '2px solid #D6C9F5'
              : isAreaNode
              ? `2px solid ${getAreaColor(node.area, node)}40`
              : '1px solid #E6E6E6'
          }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'rgba(100, 100, 100, 0.1)',
                color: '#646464'
              }}
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <div className="w-7" />
          )}

          {/* Status Icon or Avatar */}
          {isYouNode ? (
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 2px 8px rgba(201, 183, 243, 0.3)'
              }}
            >
              Yo
            </div>
          ) : isAreaNode ? (
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{
                backgroundColor: getAreaColor(node.area, node),
                boxShadow: `0px 2px 8px ${getAreaColor(node.area, node)}50`
              }}
            >
              {areas.find(a => a.name === node.name)?.icon || '📚'}
            </div>
          ) : (
            getStatusIcon(node.status)
          )}

          {/* Node Name */}
          <div className="flex-1">
            <span
              className="font-semibold"
              style={{ color: '#1E1E1E' }}
            >
              {node.name}
            </span>
            {!isYouNode && !isAreaNode && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full capitalize"
                style={{
                  backgroundColor: '#F6F6F6',
                  color: '#646464'
                }}
              >
                {node.level}
              </span>
            )}
          </div>

          {/* Area Badge */}
          {!isYouNode && !isAreaNode && (
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                backgroundColor: getAreaColor(node.area, node) + '20',
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
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                color: 'white',
                boxShadow: '0px 2px 6px rgba(201, 183, 243, 0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Estudiar
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div
            className="ml-6 pl-4"
            style={{ borderLeft: '2px solid #E6E6E6' }}
          >
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: '#1E1E1E' }}>
              Ruta de Aprendizaje
            </h1>
            <p style={{ color: '#646464' }}>
              Explora tu camino de conocimiento paso a paso
            </p>
          </div>

          <Link
            href="/graph"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: 'white',
              color: '#646464',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '1px solid #E6E6E6'
            }}
          >
            <Network className="size-5" />
            Ver en Grafo
          </Link>
        </div>

        {/* Recommendation Banner */}
        {nextRecommended && (
          <div
            className="rounded-3xl p-6 mb-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #A3D4FF 0%, #CADFFF 100%)',
              boxShadow: '0px 4px 14px rgba(163, 212, 255, 0.3)'
            }}
          >
            <div
              className="absolute top-0 right-0 w-32 h-32"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div
                  className="p-3 rounded-2xl"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
                >
                  <Lightbulb className="size-6" style={{ color: '#5A8FCC' }} />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#5A8FCC' }}>
                    Siguiente recomendado:
                  </p>
                  <p className="text-lg font-bold" style={{ color: '#1E1E1E' }}>
                    {nextRecommended.name}
                  </p>
                </div>
              </div>
              <Link
                href={`/study?topic=${encodeURIComponent(nextRecommended.name)}`}
                className="px-6 py-3 rounded-2xl font-semibold transition-all hover:scale-105 flex items-center gap-2"
                style={{
                  backgroundColor: 'white',
                  color: '#5A8FCC',
                  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                Comenzar
                <ArrowRight className="size-5" />
              </Link>
            </div>
          </div>
        )}

        {/* Area Filter */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedArea(null)}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium transition-all hover:scale-105"
            style={{
              background: selectedArea === null
                ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                : 'white',
              color: selectedArea === null ? 'white' : '#646464',
              boxShadow: selectedArea === null
                ? '0px 2px 8px rgba(201, 183, 243, 0.3)'
                : '0px 2px 8px rgba(0, 0, 0, 0.04)',
              border: selectedArea === null ? 'none' : '1px solid #E6E6E6'
            }}
          >
            Todas las areas
          </button>
          {areas.map(area => (
            <button
              key={area.id}
              onClick={() => setSelectedArea(area.name)}
              className="px-5 py-2.5 rounded-2xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
              style={{
                backgroundColor: selectedArea === area.name ? area.color : 'white',
                color: selectedArea === area.name ? 'white' : '#646464',
                boxShadow: selectedArea === area.name
                  ? `0px 2px 8px ${area.color}50`
                  : '0px 2px 8px rgba(0, 0, 0, 0.04)',
                border: selectedArea === area.name ? 'none' : '1px solid #E6E6E6'
              }}
            >
              <span>{area.icon || '📚'}</span>
              {area.name}
            </button>
          ))}
        </div>

        {/* Tree View */}
        <div
          className="rounded-3xl p-6"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          {loading ? (
            <div className="text-center py-12" style={{ color: '#646464' }}>
              Cargando ruta...
            </div>
          ) : tree.length > 0 ? (
            tree.map(node => renderTreeNode(node))
          ) : (
            <div className="text-center py-12" style={{ color: '#646464' }}>
              No hay conceptos en tu ruta todavia
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="mt-6 rounded-2xl p-5"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          <h4 className="text-sm font-semibold mb-4" style={{ color: '#1E1E1E' }}>
            Estado de los conceptos
          </h4>
          <div className="flex gap-8">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #A3E4B6 0%, #B9E2B1 100%)',
                  boxShadow: '0px 2px 6px rgba(163, 228, 182, 0.3)'
                }}
              />
              <span className="text-sm" style={{ color: '#646464' }}>Dominado</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #FFE9A9 0%, #FFF4D4 100%)',
                  boxShadow: '0px 2px 6px rgba(255, 233, 169, 0.3)'
                }}
              />
              <span className="text-sm" style={{ color: '#646464' }}>En progreso</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #E6E6E6 0%, #F0F0F0 100%)',
                  boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)'
                }}
              />
              <span className="text-sm" style={{ color: '#646464' }}>Pendiente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
