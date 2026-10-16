import { IDENTITIES, type IdentityKey } from '@habitos/contracts';

export function identity(key: string) {
  return (
    IDENTITIES[key as IdentityKey] ?? { label: key, noun: key, icon: 'star', color: '#6B675F' }
  );
}

/** Plantillas con la versión de 2 minutos ya escrita: solo falta elegir la hora. */
export const TEMPLATES: Array<{
  identity: IdentityKey;
  kind: 'build' | 'break';
  title: string;
  minVersion: string | null;
  cueTime: string | null;
  cuePlace: string | null;
}> = [
  {
    identity: 'reader',
    kind: 'build',
    title: 'Leer 10 páginas',
    minVersion: 'Leer 1 página',
    cueTime: '21:30',
    cuePlace: 'la cama',
  },
  {
    identity: 'athlete',
    kind: 'build',
    title: 'Hacer ejercicio 20 min',
    minVersion: 'Ponerme los tenis',
    cueTime: '07:00',
    cuePlace: 'casa',
  },
  {
    identity: 'healthy',
    kind: 'build',
    title: 'Tomar 8 vasos de agua',
    minVersion: 'Un vaso al despertar',
    cueTime: '08:00',
    cuePlace: 'la cocina',
  },
  {
    identity: 'focused',
    kind: 'build',
    title: 'Trabajo profundo 1 hora',
    minVersion: 'Abrir la tarea y escribir una línea',
    cueTime: '09:00',
    cuePlace: 'el escritorio',
  },
  {
    identity: 'calm',
    kind: 'build',
    title: 'Meditar 10 minutos',
    minVersion: 'Tres respiraciones',
    cueTime: '07:30',
    cuePlace: 'la sala',
  },
  {
    identity: 'creative',
    kind: 'build',
    title: 'Escribir 300 palabras',
    minVersion: 'Escribir una frase',
    cueTime: '20:00',
    cuePlace: 'el escritorio',
  },
  {
    identity: 'free',
    kind: 'break',
    title: 'Sin redes sociales de noche',
    minVersion: null,
    cueTime: '21:00',
    cuePlace: null,
  },
];
