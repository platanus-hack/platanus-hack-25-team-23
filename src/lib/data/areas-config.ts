// Shared areas configuration for Library, Graph, and Tree pages
// These are the 7 main life areas that organize all knowledge

export interface AreaConfig {
  id: string
  name: string
  description: string
  icon: string
  color: string
  colorVariants: string[]
  keywords: string[]
}

export const DEFAULT_AREAS: AreaConfig[] = [
  {
    id: 'desarrollo-profesional',
    name: 'Desarrollo Profesional',
    description: 'Habilidades técnicas y profesionales',
    icon: '💼',
    color: '#93c5fd', // Pastel blue
    colorVariants: [], // Generated dynamically
    keywords: ['trabajo', 'carrera', 'profesional', 'empresa', 'negocio', 'programacion', 'codigo', 'software', 'algoritmo', 'javascript', 'python', 'react', 'web', 'backend', 'frontend', 'devops', 'api', 'base de datos', 'office', 'linkedin', 'cv', 'curriculum', 'entrevista laboral', 'startup', 'emprendimiento']
  },
  {
    id: 'salud-bienestar',
    name: 'Salud y Bienestar',
    description: 'Cuidado físico y mental',
    icon: '🏃',
    color: '#86efac', // Pastel green
    colorVariants: [], // Generated dynamically
    keywords: ['salud', 'ejercicio', 'fitness', 'nutricion', 'dieta', 'deporte', 'bienestar', 'mental', 'fisico', 'gym', 'entrenamiento', 'yoga', 'meditacion', 'dormir', 'sueño', 'abdominal', 'muscul', 'cuerpo', 'peso', 'cardio', 'correr', 'nadar', 'flexion', 'sentadilla', 'proteina', 'caloria', 'grasa', 'adelgazar', 'engordar', 'rutina de ejercicio', 'gimnasio', 'pesas', 'fuerza', 'resistencia', 'flexibilidad', 'estirar', 'core', 'pierna', 'brazo', 'espalda', 'pecho', 'hombro', 'gluteo', 'bicep', 'tricep', 'plancha', 'crunch', 'doctor', 'medico', 'hospital', 'enfermedad', 'vitamina', 'suplemento']
  },
  {
    id: 'finanzas-personales',
    name: 'Finanzas Personales',
    description: 'Gestión económica y ahorro',
    icon: '💰',
    color: '#fde047', // Pastel yellow
    colorVariants: [], // Generated dynamically
    keywords: ['finanza', 'dinero', 'ahorro', 'inversion', 'presupuesto', 'economia', 'banco', 'credito', 'deuda', 'patrimonio', 'rentabilidad', 'acciones', 'crypto']
  },
  {
    id: 'relaciones-familia',
    name: 'Relaciones y Familia',
    description: 'Vínculos y comunicación',
    icon: '❤️',
    color: '#f9a8d4', // Pastel pink
    colorVariants: [], // Generated dynamically
    keywords: ['familia', 'relacion', 'amigo', 'pareja', 'amor', 'comunicacion', 'social', 'matrimonio', 'hijos', 'padres', 'vinculo', 'amistad']
  },
  {
    id: 'hobbies-creatividad',
    name: 'Hobbies y Creatividad',
    description: 'Pasiones y expresión creativa',
    icon: '🎨',
    color: '#fdba74', // Pastel orange
    colorVariants: [], // Generated dynamically
    keywords: ['hobby', 'arte', 'musica', 'dibujo', 'pintura', 'fotografia', 'video', 'juego', 'deporte', 'coleccion', 'manualidad', 'creatividad', 'diseño']
  },
  {
    id: 'educacion-continua',
    name: 'Educación Continua',
    description: 'Aprendizaje permanente',
    icon: '📚',
    color: '#c4b5fd', // Pastel purple
    colorVariants: [], // Generated dynamically
    keywords: ['educacion', 'aprendizaje', 'curso', 'estudio', 'lectura', 'libro', 'universidad', 'certificacion', 'idioma', 'ingles', 'matematica', 'ciencia', 'historia']
  },
  {
    id: 'crecimiento-personal',
    name: 'Crecimiento Personal',
    description: 'Autodesarrollo y mindfulness',
    icon: '🌱',
    color: '#d8b4fe', // Pastel violet
    colorVariants: [], // Generated dynamically
    keywords: ['crecimiento', 'personal', 'habito', 'productividad', 'mindfulness', 'meditacion', 'autoconocimiento', 'motivacion', 'objetivo', 'meta', 'disciplina', 'rutina']
  }
]

// Default color for the central "Yo" node - stronger purple to stand out from pastel areas
export const DEFAULT_YOU_NODE_COLOR = '#8B5CF6'

// Color palette for "Yo" node color picker - Stronger/vibrant colors to stand out
export const COLOR_PALETTE = [
  '#8B5CF6', // Vibrant violet
  '#3B82F6', // Vibrant blue
  '#22C55E', // Vibrant green
  '#F97316', // Vibrant orange
  '#EC4899', // Vibrant pink
  '#6366F1', // Vibrant indigo
  '#EAB308', // Vibrant yellow
  '#EF4444', // Vibrant red
  '#14B8A6', // Vibrant teal
  '#A855F7', // Vibrant purple
  '#06B6D4', // Vibrant cyan
  '#84CC16', // Vibrant lime
]

// Helper to detect area based on content - counts keyword matches and returns area with most matches
export function detectAreaFromContent(title: string, content: string): AreaConfig | null {
  const text = `${title} ${content}`.toLowerCase()

  let bestArea: AreaConfig | null = null
  let bestScore = 0

  for (const area of DEFAULT_AREAS) {
    let score = 0
    for (const keyword of area.keywords) {
      // Count how many times each keyword appears
      const regex = new RegExp(keyword.toLowerCase(), 'g')
      const matches = text.match(regex)
      if (matches) {
        score += matches.length
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestArea = area
    }
  }

  return bestArea
}

// Get area by ID
export function getAreaById(id: string): AreaConfig | undefined {
  return DEFAULT_AREAS.find(area => area.id === id)
}

// Get area by name
export function getAreaByName(name: string): AreaConfig | undefined {
  return DEFAULT_AREAS.find(area => area.name.toLowerCase() === name.toLowerCase())
}
