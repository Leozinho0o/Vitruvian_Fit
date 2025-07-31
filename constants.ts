

import { Exercise, ExerciseCategory, MeasurementType, Unit, Routine, Folder, PerceivedExertionScale } from './types';

export const DEFAULT_MUSCLE_GROUPS: string[] = [
  'Peitoral',
  'Latíssimo do dorso',
  'Bíceps',
  'Tríceps',
  'Antebraço',
  'Deltóide anterior',
  'Deltóide medial',
  'Deltóide posterior',
  'Trapézio superior',
  'Trapézio medial',
  'Rombóides',
  'Eretores da espinha',
  'Reto abdominal',
  'Oblíquos',
  'Glúteos',
  'Quadríceps',
  'Isquitibiais',
  'Adutores',
  'Panturrilha'
];


export const ROUTINE_COLORS: string[] = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'
];

export const INITIAL_EXERCISES: Exercise[] = [
  { id: 'ex1', name: 'Supino Reto', category: ExerciseCategory.RESISTED, primaryMuscles: ['Peitoral'], secondaryMuscles: ['Deltóide anterior', 'Tríceps'], measurementType: MeasurementType.COUNT, unit: Unit.KG, notes: 'Focar na contração do peitoral. Descer a barra até tocar o peito.', perceivedExertionScale: PerceivedExertionScale.RIR },
  { id: 'ex2', name: 'Agachamento Livre', category: ExerciseCategory.RESISTED, primaryMuscles: ['Quadríceps', 'Glúteos'], secondaryMuscles: ['Eretores da espinha', 'Isquitibiais'], measurementType: MeasurementType.COUNT, unit: Unit.KG, notes: 'Manter a coluna reta e descer até os 90 graus.', perceivedExertionScale: PerceivedExertionScale.RIR },
  { id: 'ex3', name: 'Corrida na Esteira', category: ExerciseCategory.CARDIO, primaryMuscles: ['Quadríceps', 'Panturrilha'], secondaryMuscles: ['Isquitibiais'], measurementType: MeasurementType.TIME, unit: Unit.SPEED, notes: 'Manter um ritmo constante.', perceivedExertionScale: PerceivedExertionScale.PSE },
  { id: 'ex4', name: 'Alongamento de Isquiotibiais', category: ExerciseCategory.FLEXIBILITY, primaryMuscles: ['Isquitibiais'], secondaryMuscles: [], measurementType: MeasurementType.TIME, unit: Unit.NONE, notes: 'Segurar a posição por 30 segundos sem forçar demais.', perceivedExertionScale: PerceivedExertionScale.PERFLEX },
];

export const INITIAL_FOLDERS: Folder[] = [
    { id: 'f1', name: 'Treinos de Força', parentId: null },
];

export const INITIAL_ROUTINES: Routine[] = [
  { 
    id: 'r1', 
    name: 'Peito e Tríceps', 
    color: '#3B82F6', 
    plannedExercises: [
      { exerciseId: 'ex1', sets: [{ reps: 12, value: 50, effort: '8' }, { reps: 10, value: 55, effort: '8.5' }, { reps: 8, value: 60, effort: '9' }] }
    ], 
    folderId: 'f1', 
    notes: 'Aquecer bem os ombros antes de começar.' 
  },
  { 
    id: 'r2', 
    name: 'Pernas e Glúteos', 
    color: '#EC4899', 
    plannedExercises: [
      { exerciseId: 'ex2', sets: [{ reps: 15, value: 80 }, { reps: 12, value: 90 }, { reps: 10, value: 100 }] }
    ], 
    folderId: 'f1', 
    notes: 'Foco na execução correta para evitar lesões no joelho.' 
  },
  { 
    id: 'r3', 
    name: 'Cardio Leve', 
    color: '#22C55E', 
    plannedExercises: [
      { exerciseId: 'ex3', sets: [{ time: 1800, value: 10, effort: '3' }] }
    ], 
    folderId: null, 
    notes: '' 
  },
];

export const PERFLEX_SCALE = [
    { value: '0-30', label: '0 - 30 Normalidade' },
    { value: '31-60', label: '31 - 60 Forçamento' },
    { value: '61-80', label: '61 - 80 Desconforto' },
    { value: '81-90', label: '81 - 90 Dor suportável' },
    { value: '91-110', label: '91 - 110 Dor forte' },
];

export const RIR_SCALE = [
    { value: '10', label: '10: Não poderia fazer mais repetições ou aumentar o peso' },
    { value: '9.5', label: '9.5: Não poderia fazer mais repetições, poderia aumentar o peso' },
    { value: '9', label: '9: Poderia fazer mais uma repetição' },
    { value: '8.5', label: '8.5: Definitivamente poderia fazer mais uma repetição, talvez duas' },
    { value: '8', label: '8: Poderia fazer mais duas repetições' },
    { value: '7.5', label: '7.5: Definitivamente poderia fazer mais duas repetições, talvez 3' },
    { value: '7', label: '7: Poderia fazer mais 3 repetições' },
    { value: '5-6', label: '5-6: Poderia fazer mais 4 ou 6 repetições' },
    { value: '1-4', label: '1-4: Esforço muito baixo' },
];

export const PSE_SCALE = [
    { value: '0', label: '0: Repouso' },
    { value: '1', label: '1: Muito, muito fácil' },
    { value: '2', label: '2: Fácil' },
    { value: '3', label: '3: Moderado' },
    { value: '4', label: '4: Um pouco difícil' },
    { value: '5', label: '5: Difícil' },
    { value: '6', label: '6' },
    { value: '7', label: '7: Muito difícil' },
    { value: '8', label: '8' },
    { value: '9', label: '9' },
    { value: '10', label: '10: Máximo' },
];

export const getScaleOptions = (scale?: PerceivedExertionScale) => {
    switch (scale) {
        case PerceivedExertionScale.PERFLEX:
            return PERFLEX_SCALE;
        case PerceivedExertionScale.RIR:
            return RIR_SCALE;
        case PerceivedExertionScale.PSE:
            return PSE_SCALE;
        default:
            return null;
    }
};