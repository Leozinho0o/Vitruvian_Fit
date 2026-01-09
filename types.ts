
export enum PerceivedExertionScale {
  PERFLEX = 'PERFLEX',
  RIR = 'RIR', // PSE baseada em repetições em reserva
  PSE = 'PSE', // PSE (Borg)
}

export enum SetType {
  NORMAL = 'Normal',
  WARM_UP = 'Aquecimento',
  CLUSTER = 'Cluster Set',
  DROP = 'Drop Set',
  BI_SET = 'Bi Set',
  SUPER_SET = 'Super Set'
}

export enum CardioMethod {
  CONTINUOUS_INTENSIVE_1 = 'Contínuo Intensivo I',
  CONTINUOUS_INTENSIVE_2 = 'Contínuo Intensivo II',
  CONTINUOUS_EXTENSIVE_1 = 'Contínuo Extensivo I',
  CONTINUOUS_EXTENSIVE_2 = 'Contínuo Extensivo II',
  FARTLEK = 'Fartlek',
  FRACTIONATED = 'Método Fracionado',
  TEMPO_TRAINING = 'Tempo Training',
  COMPETITION = 'Método da Competição',
  HIIT_LONG = 'HIIT Longo',
  HIIT_SHORT = 'HIIT Curto',
  SIT = 'SIT',
  RSA = 'Sprints Repetitivos',
  INTERMITTENT_SPRINTS = 'Sprints Intermitentes'
}

export enum FlexibilityMethod {
  FNP = 'FNP',
  DYNAMIC = 'Alongamento Dinâmico',
  STATIC = 'Alongamento Estático',
  BALLISTIC = 'Alongamento Balístico'
}

export enum Gender {
  MALE = 'Masculino',
  FEMALE = 'Feminino',
}

export enum ExerciseCategory {
  RESISTED = 'Resistido',
  CARDIO = 'Cardio',
  FLEXIBILITY = 'Flexibilidade'
}

export enum MeasurementType {
  COUNT = 'Repetições',
  TIME = 'Tempo'
}

export enum Unit {
  KG = 'kg',
  SPEED = 'km/h',
  NONE = '',
  DISTANCE = 'm'
}

export enum View {
  ROUTINES = 'Rotinas',
  EXERCISES = 'Exercícios',
  CALENDAR = 'Calendário',
  STATS = 'Estatísticas',
  SETTINGS = 'Configurações'
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export interface WorkoutSet {
  repsMin?: number;
  repsMax?: number;
  reps?: number;
  time?: number; // seconds
  value?: number; // weight, speed, etc
  effort?: string;
  completed?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  measurementType: MeasurementType;
  unit: Unit;
  notes?: string;
  perceivedExertionScale?: PerceivedExertionScale;
  includeBarbellWeight?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  isWeightDoubled?: boolean;
  isCounterweight?: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  barbellWeight?: number;
  method?: string;
  tempId?: string;
}

export interface Routine {
  id: string;
  name: string;
  color: string;
  folderId: string | null;
  plannedExercises: PlannedExercise[];
  notes?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface WorkoutSession {
  id: string;
  routineId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  duration?: number;
  originalPlan?: PlannedExercise[];
  routineSnapshot?: { name: string; color: string };
  loggedExercises: PlannedExercise[];
  completed: boolean;
}

export interface UserMeasurements {
  bodyMass?: number;
  age?: number;
  gender?: Gender;
  statureCm?: number;
  statureM?: number;
  
  // Skinfolds
  subscapularFold?: number;
  tricepsFold?: number;
  bicepsFold?: number;
  pectoralFold?: number;
  midaxillaryFold?: number;
  suprailiacFold?: number;
  abdominalFold?: number;
  thighFold?: number;
  medialCalfFold?: number;

  // Perimeters
  abdominalPerimeter?: number;
  forearmPerimeter?: number;
  biStyloidPerimeter?: number;
  biCondylarPerimeter?: number;
  waistPerimeter?: number;
}

export interface Evaluation {
  date: string;
  measurements: UserMeasurements;
}