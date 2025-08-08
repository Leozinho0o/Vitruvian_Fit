


export interface Evaluation {
  date: string; // YYYY-MM-DD
  measurements: UserMeasurements;
}

export enum ExerciseCategory {
  RESISTED = 'Resistido',
  CARDIO = 'Cardiovascular',
  FLEXIBILITY = 'Flexibilidade',
}

export enum MeasurementType {
  COUNT = 'Contagem',
  TIME = 'Tempo',
}

export enum Unit {
  KG = 'KG',
  DISTANCE = 'Distância (m)',
  SPEED = 'Velocidade (km/h)',
  POWER = 'Potência (W)',
  NONE = 'N/A'
}

export enum PerceivedExertionScale {
  PERFLEX = 'PERFLEX',
  RIR = 'RIR', // PSE baseada em repetições em reserva
  PSE = 'PSE', // PSE (Borg)
}

export enum Gender {
  MALE = 'Masculino',
  FEMALE = 'Feminino',
}

export interface UserMeasurements {
  // Dados pessoais
  bodyMass?: number;
  age?: number;
  gender?: Gender;
  statureCm?: number;
  statureM?: number; // Calculated

  // Dobras Cutâneas (mm)
  subscapularFold?: number;
  tricepsFold?: number;
  bicepsFold?: number;
  pectoralFold?: number;
  midaxillaryFold?: number;
  suprailiacFold?: number;
  abdominalFold?: number;
  thighFold?: number;
  medialCalfFold?: number;

  // Perímetros
  abdominalPerimeter?: number; // ao nível do umbigo (cm)
  forearmPerimeter?: number; // Antebraço relaxado (cm)
  biStyloidPerimeter?: number; // Biestiloide Rádio-Ulnar (cm)
  biCondylarPerimeter?: number; // Bicondiliano Femural (cm)
  waistPerimeter?: number; // cintura (m)
}


export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  measurementType: MeasurementType;
  unit: Unit;
  perceivedExertionScale?: PerceivedExertionScale;
  notes?: string;
  imageUrl?: string;
  videoUrl?: string;
  includeBarbellWeight?: boolean;
  isWeightDoubled?: boolean;
  isCounterweight?: boolean;
}

export interface WorkoutSet {
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  time?: number;
  value?: number; // for KG, Distance, Speed, Amplitude
  effort?: string; // For PERFLEX, RIR, PSE values
  completed?: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  barbellWeight?: number;
}

export interface Routine {
  id: string;
  name: string;
  color: string;
  plannedExercises: PlannedExercise[];
  folderId: string | null;
  notes?: string;
}

export interface Folder {
  id: string;
  name:string;
  parentId: string | null;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  barbellWeight?: number;
}

export interface WorkoutSession {
  id: string;
  routineId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime: string | null;
  loggedExercises: LoggedExercise[];
  completed?: boolean;
  duration?: number; // Duration in seconds
}

export enum View {
  ROUTINES = 'Rotinas',
  EXERCISES = 'Exercícios',
  CALENDAR = 'Agenda',
  STATS = 'Estatísticas',
  SETTINGS = 'Configurações',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}