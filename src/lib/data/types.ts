// Data types for BrainFlow platform

export type NodeStatus = 'pending' | 'in-progress' | 'understood';
export type CalloutType = 'note' | 'important' | 'critical' | 'question' | 'example' | 'observation';

export interface Area {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface GraphNode {
  id: string;
  name: string;
  status: NodeStatus;
  area: string;
  level: 'basic' | 'intermediate' | 'advanced';
  isYouNode?: boolean;
  isAreaNode?: boolean;
  estimatedHours?: number;
  difficulty?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface Concept {
  id: string;
  name: string;
  definition: string;
  examples: string[];
  relatedTo: string[];
  prerequisites: string[];
  nextSteps: string[];
  status: NodeStatus;
  area: string;
  level: 'basic' | 'intermediate' | 'advanced';
  isCentral: boolean;
  generatedAt?: Date;
  parentId?: string;
}

export interface StudyContent {
  id: string;
  title: string;
  content: string;
  concepts: string[];
  area: string;
  estimatedTime: number;
  prerequisites: string[];
  nextSteps: string[];
  parentId?: string;
}

export interface NavigationItem {
  noteId: string;
  scrollPosition: number;
  timestamp: Date;
}

export interface NodiSuggestion {
  id: string;
  type: 'prerequisite' | 'celebration' | 'next-step' | 'tip';
  message: string;
  actionLabel?: string;
  actionNoteId?: string;
}

export interface UserStats {
  totalNodes: number;
  understoodNodes: number;
  inProgressNodes: number;
  studyTime: number;
  streak: number;
  areasProgress: Record<string, number>;
}

export type View = 'landing' | 'dashboard' | 'study' | 'graph' | 'tree' | 'profile' | 'new-query' | 'library';

// Default areas (7 Life Areas)
export const DEFAULT_AREAS: Area[] = [
  {
    id: 'area-desarrollo',
    name: 'Desarrollo Profesional',
    color: '#7FBFFF',
    icon: '\ud83d\udcbb',
    description: 'Habilidades t\u00e9cnicas y profesionales'
  },
  {
    id: 'area-salud',
    name: 'Salud y Bienestar',
    color: '#A3E4B6',
    icon: '\ud83d\udcaa',
    description: 'Cuidado f\u00edsico y mental'
  },
  {
    id: 'area-finanzas',
    name: 'Finanzas Personales',
    color: '#FFEF84',
    icon: '\ud83d\udcb0',
    description: 'Gesti\u00f3n econ\u00f3mica y ahorro'
  },
  {
    id: 'area-relaciones',
    name: 'Relaciones y Familia',
    color: '#F7B9C8',
    icon: '\u2764\ufe0f',
    description: 'V\u00ednculos y comunicaci\u00f3n'
  },
  {
    id: 'area-hobbies',
    name: 'Hobbies y Creatividad',
    color: '#FFD5A5',
    icon: '\ud83c\udfa8',
    description: 'Pasiones y expresi\u00f3n creativa'
  },
  {
    id: 'area-educacion',
    name: 'Educaci\u00f3n Continua',
    color: '#CADFFF',
    icon: '\ud83d\udcda',
    description: 'Aprendizaje permanente'
  },
  {
    id: 'area-crecimiento',
    name: 'Crecimiento Personal',
    color: '#C9B7F3',
    icon: '\ud83c\udf31',
    description: 'Autodesarrollo y mindfulness'
  },
];

// Default graph nodes
export const DEFAULT_NODES: GraphNode[] = [
  // Central "Yo" node
  { id: 'yo', name: '\ud83e\udde0 Yo', status: 'understood', area: 'Centro', level: 'basic', isYouNode: true },

  // Area nodes (nuclei)
  { id: 'area-desarrollo', name: 'Desarrollo Profesional', status: 'understood', area: 'Desarrollo Profesional', level: 'basic', isAreaNode: true },
  { id: 'area-salud', name: 'Salud y Bienestar', status: 'understood', area: 'Salud y Bienestar', level: 'basic', isAreaNode: true },
  { id: 'area-finanzas', name: 'Finanzas Personales', status: 'understood', area: 'Finanzas Personales', level: 'basic', isAreaNode: true },
  { id: 'area-relaciones', name: 'Relaciones y Familia', status: 'understood', area: 'Relaciones y Familia', level: 'basic', isAreaNode: true },
  { id: 'area-hobbies', name: 'Hobbies y Creatividad', status: 'understood', area: 'Hobbies y Creatividad', level: 'basic', isAreaNode: true },
  { id: 'area-educacion', name: 'Educaci\u00f3n Continua', status: 'understood', area: 'Educaci\u00f3n Continua', level: 'basic', isAreaNode: true },
  { id: 'area-crecimiento', name: 'Crecimiento Personal', status: 'understood', area: 'Crecimiento Personal', level: 'basic', isAreaNode: true },

  // Sample nodes for each area
  { id: 'n1', name: 'HTML y CSS B\u00e1sico', status: 'understood', area: 'Desarrollo Profesional', level: 'basic', estimatedHours: 4, difficulty: 2 },
  { id: 'n2', name: 'JavaScript Fundamentals', status: 'understood', area: 'Desarrollo Profesional', level: 'basic', estimatedHours: 6, difficulty: 3 },
  { id: 'n3', name: 'React Hooks', status: 'in-progress', area: 'Desarrollo Profesional', level: 'intermediate', estimatedHours: 8, difficulty: 4 },
  { id: 'n4', name: 'Node.js Express', status: 'pending', area: 'Desarrollo Profesional', level: 'advanced', estimatedHours: 10, difficulty: 5 },

  { id: 'n5', name: 'Fundamentos de Nutrici\u00f3n', status: 'understood', area: 'Salud y Bienestar', level: 'basic', estimatedHours: 3, difficulty: 2 },
  { id: 'n6', name: 'Calcular Macros', status: 'in-progress', area: 'Salud y Bienestar', level: 'intermediate', estimatedHours: 2, difficulty: 3 },
  { id: 'n7', name: 'Rutina de Ejercicio', status: 'pending', area: 'Salud y Bienestar', level: 'intermediate', estimatedHours: 4, difficulty: 3 },

  { id: 'n8', name: 'Tracking de Gastos', status: 'understood', area: 'Finanzas Personales', level: 'basic', estimatedHours: 2, difficulty: 1 },
  { id: 'n9', name: 'Presupuesto 50/30/20', status: 'in-progress', area: 'Finanzas Personales', level: 'intermediate', estimatedHours: 3, difficulty: 2 },
  { id: 'n10', name: 'ETFs para Principiantes', status: 'pending', area: 'Finanzas Personales', level: 'advanced', estimatedHours: 6, difficulty: 4 },
];

// Default graph links
export const DEFAULT_LINKS: GraphLink[] = [
  // Connections from "Yo" to all areas
  { source: 'yo', target: 'area-desarrollo' },
  { source: 'yo', target: 'area-salud' },
  { source: 'yo', target: 'area-finanzas' },
  { source: 'yo', target: 'area-relaciones' },
  { source: 'yo', target: 'area-hobbies' },
  { source: 'yo', target: 'area-educacion' },
  { source: 'yo', target: 'area-crecimiento' },

  // Connections from areas to topics
  { source: 'area-desarrollo', target: 'n1' },
  { source: 'n1', target: 'n2' },
  { source: 'n2', target: 'n3' },
  { source: 'n3', target: 'n4' },

  { source: 'area-salud', target: 'n5' },
  { source: 'n5', target: 'n6' },
  { source: 'n6', target: 'n7' },

  { source: 'area-finanzas', target: 'n8' },
  { source: 'n8', target: 'n9' },
  { source: 'n9', target: 'n10' },
];

// Suggested topics for NewQueryView
export const SUGGESTED_TOPICS = [
  {
    title: 'Machine Learning',
    icon: '\ud83e\udd16',
    area: 'Inteligencia Artificial',
    popular: true,
    bgColor: '#E6DEF9',
    color: '#9575CD'
  },
  {
    title: 'Fotos\u00edntesis',
    icon: '\ud83c\udf31',
    area: 'Biolog\u00eda',
    popular: true,
    bgColor: '#D4F0CE',
    color: '#5FA857'
  },
  {
    title: 'Programaci\u00f3n Din\u00e1mica',
    icon: '\ud83d\udc8e',
    area: 'Algoritmos',
    popular: false,
    bgColor: '#CADFFF',
    color: '#5A8FCC'
  },
  {
    title: 'Renacimiento Italiano',
    icon: '\ud83c\udfa8',
    area: 'Historia',
    popular: true,
    bgColor: '#FDD4DD',
    color: '#D88BA0'
  },
  {
    title: 'Marketing Digital',
    icon: '\ud83d\udcf1',
    area: 'Negocios',
    popular: true,
    bgColor: '#FFE8CC',
    color: '#CC7E4A'
  },
  {
    title: '\u00c1rboles Binarios',
    icon: '\ud83c\udf33',
    area: 'Estructuras de Datos',
    popular: false,
    bgColor: '#FFF4D4',
    color: '#B89C3C'
  }
];
