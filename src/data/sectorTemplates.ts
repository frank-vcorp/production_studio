/**
 * 6 plantillas de sector pre-llenadas para BriefWizard v2.
 * Spec: SPEC-S5-WIZARD-A11Y §Tarea 5.2.
 *
 * Cada sector trae:
 *  - defaultBusiness: audiencia + differentiators pre-llenados
 *  - defaultServices: 2-3 servicios típicos con precio + keyBenefit
 *  - defaultGlobalVision: tono + paleta + pacing característico
 *  - defaultStages: copy AIDA por servicio (atencion/interes/deseo/accion)
 *
 * El sector 'otro' trae defaults vacíos para entrada manual sin errores.
 * ID: IMPL-20260704-05.
 */

import type { SectorTemplate } from '@/types/sector';

export const SECTOR_TEMPLATES: Record<SectorTemplate['id'], SectorTemplate> = {
  automotriz: {
    id: 'automotriz',
    name: 'Automotriz',
    emoji: '🚗',
    description: 'Taller mecánico, concesionario, refacciones',
    defaultBusiness: {
      sector: 'automotriz',
      audience: 'Conductores que buscan servicio confiable, rápido y honesto',
      differentiators: [
        'Servicio rápido',
        'Garantía escrita',
        'Refacciones originales',
      ],
    },
    defaultServices: [
      {
        id: 'svc_cambio_aceite',
        name: 'Cambio de Aceite Sintético',
        description: 'Aceite 5W-30, filtro OEM, revisión de niveles',
        price: '$450 MXN',
        keyBenefit: 'Protección garantizada por 15,000 km',
        stages: {
          attention:
            'Primer plano de filtro viejo con aceite quemado en manos. Texto: "¿Cuándo cambiaste el aceite DE VERDAD?"',
          interest:
            'Recorrido por boxes limpios, pared de aceites ordenada con certificación ISO visible',
          desire:
            'Aceite dorado nuevo fluyendo por el motor. Métrica visible: "15,000 km garantizado"',
          action:
            'Tarjeta final con logo + WhatsApp + Maps + fondo del taller real',
        },
      },
      {
        id: 'svc_frenos',
        name: 'Frenos y Suspensión',
        description: 'Balatas, discos, amortiguadores, alineación',
        price: 'Desde $1,200 MXN',
        keyBenefit: 'Recuperá el control y la seguridad de tu auto',
        stages: {
          attention:
            'Mano apretando el volante con luz de freno encendida en el tablero',
          interest:
            'Comparación lado a lado: balata gastada vs balata nueva brillante',
          desire:
            'Auto frenando en curva con humo mínimo, conductor tranquilo sonriendo',
          action:
            'Pantalla dividida: precio desde $1,200 + WhatsApp directo',
        },
      },
      {
        id: 'svc_pintura',
        name: 'Pintura y Enderezada',
        description: 'Pintura base agua, igualación de color, pulido',
        price: 'Cotización por pieza',
        keyBenefit: 'Restauramos tu auto como recién salido de agencia',
        stages: {
          attention:
            'Antes/después impactante: golpe visible vs pintura impecable con reflejo',
          interest:
            'Cabina de pintura con luz blanca, técnico con uniforme aplicando pistola',
          desire:
            'Reflejo perfecto del técnico en la puerta recién pintada, gotas de agua resbalando',
          action:
            'Cierre con logo del taller + QR a calculadora de cotización',
        },
      },
    ],
    defaultGlobalVision: {
      style: 'Documental industrial con luz natural y tonos azul/gris acero. Tomas limpias y directas.',
      musicMood: 'Confianza con ritmo mecánico al inicio, calmado al cierre',
      pacing: 'rapido',
      toneKeywords: ['confianza', 'rapidez', 'profesionalismo', 'honestidad'],
      avoidKeywords: ['promesas exageradas', 'texto en pantalla'],
      suggestedPalette: ['#0f172a', '#38bdf8', '#94a3b8'],
    },
    defaultStages: {
      svc_cambio_aceite: {
        attention:
          'Primer plano de filtro viejo con aceite quemado en manos. Texto: "¿Cuándo cambiaste el aceite DE VERDAD?"',
        interest:
          'Recorrido por boxes limpios, pared de aceites ordenada con certificación ISO visible',
        desire:
          'Aceite dorado nuevo fluyendo por el motor. Métrica visible: "15,000 km garantizado"',
        action: 'Tarjeta final con logo + WhatsApp + Maps + fondo del taller real',
      },
      svc_frenos: {
        attention:
          'Mano apretando el volante con luz de freno encendida en el tablero',
        interest:
          'Comparación lado a lado: balata gastada vs balata nueva brillante',
        desire:
          'Auto frenando en curva con humo mínimo, conductor tranquilo sonriendo',
        action: 'Pantalla dividida: precio desde $1,200 + WhatsApp directo',
      },
      svc_pintura: {
        attention:
          'Antes/después impactante: golpe visible vs pintura impecable con reflejo',
        interest:
          'Cabina de pintura con luz blanca, técnico con uniforme aplicando pistola',
        desire:
          'Reflejo perfecto del técnico en la puerta recién pintada, gotas de agua resbalando',
        action: 'Cierre con logo del taller + QR a calculadora de cotización',
      },
    },
  },

  estetica: {
    id: 'estetica',
    name: 'Estética y Belleza',
    emoji: '💇',
    description: 'Salón de belleza, spa, barbería',
    defaultBusiness: {
      sector: 'estetica',
      audience: 'Personas que buscan transformación personal y autocuidado',
      differentiators: [
        'Productos premium',
        'Profesionales certificados',
        'Ambiente relajado',
      ],
    },
    defaultServices: [
      {
        id: 'svc_corte',
        name: 'Corte y Peinado',
        description: 'Corte personalizado + peinado profesional',
        price: 'Desde $350 MXN',
        keyBenefit: 'Encontrá el estilo que te define',
        stages: {
          attention:
            'Mujer frente al espejo con cabello sin forma, gesto de frustración',
          interest:
            'Tijera cortando con precisión, mechón cayendo, luz cálida',
          desire:
            'Cliente mirándose al espejo con sonrisa, cabello nuevo con movimiento',
          action: 'Reserva online + Instagram del salón + precio desde $350',
        },
      },
      {
        id: 'svc_coloracion',
        name: 'Coloración y Mechas',
        description: 'Tonos balayage, mechas californianas, cubre canas',
        price: 'Desde $800 MXN',
        keyBenefit: 'Color vibrante y duradero sin dañar tu cabello',
        stages: {
          attention:
            'Cabello con canas visibles o color apagado en primer plano',
          interest:
            'Tarro de tinte premium, paleta de colores, guantes aplicándolo',
          desire:
            'Reflejo del nuevo color bajo luz natural, cliente girando la cabeza',
          action: 'Muestra de tonos disponibles + WhatsApp + antes/después',
        },
      },
    ],
    defaultGlobalVision: {
      style: 'Cálido, elegante, con luz dorada y tonos pastel. Tomas suaves, movimiento lento.',
      musicMood: 'Relajante y sofisticado, estilo chillout',
      pacing: 'balanceado',
      toneKeywords: ['belleza', 'autocuidado', 'transformación', 'bienestar'],
      avoidKeywords: ['filtros extremos', 'resultados irreales'],
      suggestedPalette: ['#fde68a', '#fbcfe8', '#a78bfa'],
    },
    defaultStages: {
      svc_corte: {
        attention:
          'Mujer frente al espejo con cabello sin forma, gesto de frustración',
        interest:
          'Tijera cortando con precisión, mechón cayendo, luz cálida',
        desire:
          'Cliente mirándose al espejo con sonrisa, cabello nuevo con movimiento',
        action: 'Reserva online + Instagram del salón + precio desde $350',
      },
      svc_coloracion: {
        attention:
          'Cabello con canas visibles o color apagado en primer plano',
        interest:
          'Tarro de tinte premium, paleta de colores, guantes aplicándolo',
        desire:
          'Reflejo del nuevo color bajo luz natural, cliente girando la cabeza',
        action: 'Muestra de tonos disponibles + WhatsApp + antes/después',
      },
    },
  },

  comida: {
    id: 'comida',
    name: 'Comida y Restaurante',
    emoji: '🍔',
    description: 'Restaurante, cafetería, dark kitchen, food truck',
    defaultBusiness: {
      sector: 'comida',
      audience: 'Comensales que buscan sabor auténtico y experiencia memorable',
      differentiators: [
        'Ingredientes frescos',
        'Receta original',
        'Ambiente acogedor',
      ],
    },
    defaultServices: [
      {
        id: 'svc_platos',
        name: 'Platos Fuertes',
        description: 'Platos signature con ingredientes locales',
        price: 'Desde $180 MXN',
        keyBenefit: 'Sabor que no encuentras en otro lugar',
        stages: {
          attention:
            'Mesa vacía, plato sirviéndose en cámara lenta con vapor saliendo',
          interest:
            'Chef emplatando con precisión, ingredientes frescos en segundo plano',
          desire:
            'Primer plano del plato con salsa brillante, textura visible, bocado a cámara lenta',
          action: 'Reserva por WhatsApp + ubicación + Instagram con fotos',
        },
      },
      {
        id: 'svc_postres',
        name: 'Postres Artesanales',
        description: 'Postres de la casa hechos diariamente',
        price: 'Desde $85 MXN',
        keyBenefit: 'El cierre perfecto para una gran comida',
        stages: {
          attention:
            'Cucharón partiendo un postre con crema derretida en cámara lenta',
          interest:
            'Mostrador de pastelería iluminado, vitrina con variedad',
          desire:
            'Cliente cerrando los ojos al probar el postre, expresión de felicidad',
          action: 'Menú del día + WhatsApp + oferta por combos',
        },
      },
    ],
    defaultGlobalVision: {
      style: 'Apetitoso, cercano, con luz cálida ámbar. Tomas vibrantes y cercanas.',
      musicMood: 'Jazz suave o acústica, ambiente de restaurante',
      pacing: 'balanceado',
      toneKeywords: ['sabor', 'artesanía', 'tradición', 'acogida'],
      avoidKeywords: ['comida rápida genérica', 'precios no visibles'],
      suggestedPalette: ['#f59e0b', '#dc2626', '#7c2d12'],
    },
    defaultStages: {
      svc_platos: {
        attention:
          'Mesa vacía, plato sirviéndose en cámara lenta con vapor saliendo',
        interest:
          'Chef emplatando con precisión, ingredientes frescos en segundo plano',
        desire:
          'Primer plano del plato con salsa brillante, textura visible, bocado a cámara lenta',
        action: 'Reserva por WhatsApp + ubicación + Instagram con fotos',
      },
      svc_postres: {
        attention:
          'Cucharón partiendo un postre con crema derretida en cámara lenta',
        interest:
          'Mostrador de pastelería iluminado, vitrina con variedad',
        desire:
          'Cliente cerrando los ojos al probar el postre, expresión de felicidad',
        action: 'Menú del día + WhatsApp + oferta por combos',
      },
    },
  },

  salud: {
    id: 'salud',
    name: 'Salud y Bienestar',
    emoji: '⚕️',
    description: 'Consultorio, clínica dental, psicología, nutrición',
    defaultBusiness: {
      sector: 'salud',
      audience: 'Pacientes que buscan atención profesional y empática',
      differentiators: [
        'Profesionales certificados',
        'Equipamiento moderno',
        'Trato humano',
      ],
    },
    defaultServices: [
      {
        id: 'svc_consultas',
        name: 'Consultas Especializadas',
        description: 'Consultas con profesionales certificados',
        price: 'Desde $600 MXN',
        keyBenefit: 'Diagnóstico claro y plan personalizado',
        stages: {
          attention:
            'Persona buscando síntomas en Google con gesto preocupado',
          interest:
            'Doctor con bata, consultorio moderno, explicando con pantalla',
          desire:
            'Paciente sonriendo después de la consulta, con plan impreso en mano',
          action: 'Agenda online + WhatsApp + ubicación + primeras 3 consultas con 20%',
        },
      },
      {
        id: 'svc_analisis',
        name: 'Análisis y Estudios',
        description: 'Análisis clínicos con resultados en 24h',
        price: 'Desde $350 MXN',
        keyBenefit: 'Resultados confiables y rápidos',
        stages: {
          attention:
            'Tubo de sangre en primer plano con calendario de espera',
          interest:
            'Laboratorio moderno, equipo automatizado, técnico con uniforme',
          desire:
            'Pantalla mostrando resultados claros, médico explicando con gráfica',
          action: 'Resultados en 24h + envío por email + recordatorio anual',
        },
      },
    ],
    defaultGlobalVision: {
      style: 'Confiable, limpio, con luz blanca y tonos verde menta. Tomas estables y profesionales.',
      musicMood: 'Instrumental calmado, piano suave',
      pacing: 'balanceado',
      toneKeywords: ['confianza', 'profesionalismo', 'cuidado', 'calidez'],
      avoidKeywords: ['lenguaje alarmista', 'promesas médicas absolutas'],
      suggestedPalette: ['#10b981', '#3b82f6', '#f8fafc'],
    },
    defaultStages: {
      svc_consultas: {
        attention:
          'Persona buscando síntomas en Google con gesto preocupado',
        interest:
          'Doctor con bata, consultorio moderno, explicando con pantalla',
        desire:
          'Paciente sonriendo después de la consulta, con plan impreso en mano',
        action: 'Agenda online + WhatsApp + ubicación + primeras 3 consultas con 20%',
      },
      svc_analisis: {
        attention: 'Tubo de sangre en primer plano con calendario de espera',
        interest:
          'Laboratorio moderno, equipo automatizado, técnico con uniforme',
        desire:
          'Pantalla mostrando resultados claros, médico explicando con gráfica',
        action: 'Resultados en 24h + envío por email + recordatorio anual',
      },
    },
  },

  inmobiliaria: {
    id: 'inmobiliaria',
    name: 'Inmobiliaria',
    emoji: '🏠',
    description: 'Venta, alquiler, desarrollos, asesoría',
    defaultBusiness: {
      sector: 'inmobiliaria',
      audience: 'Personas buscando hogar, inversión o cambio de espacio',
      differentiators: [
        'Portafolio verificado',
        'Asesoría personalizada',
        'Trato transparente',
      ],
    },
    defaultServices: [
      {
        id: 'svc_venta',
        name: 'Venta de Propiedades',
        description: 'Casas, departamentos y locales en venta',
        price: 'Comisión estándar',
        keyBenefit: 'Encuentra tu hogar ideal con asesoría experta',
        stages: {
          attention:
            'Persona frente a varias ventanas de un edificio con gesto de indecisión',
          interest:
            'Recorrido por el interior: sala luminosa, cocina moderna, recámara',
          desire:
            'Familia disfrutando el espacio, luz natural entrando por ventanal',
          action: 'Catálogo + WhatsApp + tour virtual + agendado en línea',
        },
      },
      {
        id: 'svc_alquiler',
        name: 'Alquiler y Renta',
        description: 'Propiedades en renta con contrato transparente',
        price: 'Desde $8,000 MXN/mes',
        keyBenefit: 'Renta sin sorpresas, contrato claro',
        stages: {
          attention:
            'Persona firmando contrato con gesto confundido por letra pequeña',
          interest:
            'Documento resaltado en pantalla: cláusulas claras sin trampa',
          desire:
            'Llaves entregándose con sonrisa, mudanza en segundo plano',
          action: 'Disponibilidad inmediata + WhatsApp + tour virtual 360°',
        },
      },
    ],
    defaultGlobalVision: {
      style: 'Aspiracional, premium, con luz natural y tonos neutros. Tomas amplias y estables.',
      musicMood: 'Piano elegante y moderno, estilo boutique',
      pacing: 'balanceado',
      toneKeywords: ['aspiración', 'confianza', 'lujo accesible', 'transparencia'],
      avoidKeywords: ['presión de venta', 'garantías absolutas'],
      suggestedPalette: ['#0c4a6e', '#fbbf24', '#f8fafc'],
    },
    defaultStages: {
      svc_venta: {
        attention:
          'Persona frente a varias ventanas de un edificio con gesto de indecisión',
        interest:
          'Recorrido por el interior: sala luminosa, cocina moderna, recámara',
        desire:
          'Familia disfrutando el espacio, luz natural entrando por ventanal',
        action: 'Catálogo + WhatsApp + tour virtual + agendado en línea',
      },
      svc_alquiler: {
        attention:
          'Persona firmando contrato con gesto confundido por letra pequeña',
        interest:
          'Documento resaltado en pantalla: cláusulas claras sin trampa',
        desire:
          'Llaves entregándose con sonrisa, mudanza en segundo plano',
        action: 'Disponibilidad inmediata + WhatsApp + tour virtual 360°',
      },
    },
  },

  otro: {
    id: 'otro',
    name: 'Otro (manual)',
    emoji: '📝',
    description: 'Ninguno de los anteriores — define manualmente',
    defaultBusiness: {},
    defaultServices: [],
    defaultGlobalVision: {},
    defaultStages: {},
  },
};

export const SECTOR_IDS: Array<SectorTemplate['id']> = [
  'automotriz',
  'estetica',
  'comida',
  'salud',
  'inmobiliaria',
  'otro',
];

/** Devuelve la plantilla para un id, con fallback a 'otro'. */
export function getSectorTemplate(id: string): SectorTemplate {
  return SECTOR_TEMPLATES[(id as SectorTemplate['id'])] ?? SECTOR_TEMPLATES.otro;
}