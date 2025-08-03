

import { WorkoutSet, UserMeasurements, Gender } from './types';

// Helper function to format total seconds into MM:SS format
export const formatSecondsToMMSS = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) {
    return '';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Helper function to format duration for display (HH:MM:SS or MM:SS)
export const formatDuration = (totalSeconds: number | null | undefined): string | null => {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds <= 0) {
    return null;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${paddedMinutes}:${paddedSeconds}`;
};


// Helper function to parse a time string (e.g., "MM:SS") into total seconds
export const parseTimeToSeconds = (timeStr: string): number | undefined => {
    if (!timeStr || typeof timeStr !== 'string' || timeStr.trim() === '') {
        return undefined;
    }

    const cleanValue = timeStr.replace(/[^0-9:]/g, '');
    if (cleanValue.trim() === '') return undefined;

    if (cleanValue.includes(':')) {
        const parts = cleanValue.split(':');
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        if (isNaN(minutes) || isNaN(seconds)) return undefined;
        return minutes * 60 + seconds;
    }

    const num = parseInt(cleanValue, 10);
    if (isNaN(num)) return undefined;

    if (num >= 100) {
        const minutes = Math.floor(num / 100);
        const seconds = num % 100;
        return minutes * 60 + seconds;
    }
    
    return num;
};

// Helper function to parse effort string to a representative number
export const parseEffortToNumber = (effort: string | undefined): number => {
    if (!effort) {
        return 0;
    }
    if (effort.includes('-')) {
        const parts = effort.split('-').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] + parts[1]) / 2;
        }
    }
    const num = parseFloat(effort);
    return isNaN(num) ? 0 : num;
};


// Helper function to get an average or definite rep count from a set
export const getAverageReps = (set: WorkoutSet): number => {
    // For planned statistics, prioritize the average of a rep range if it exists.
    if (set.repsMin !== undefined && set.repsMax !== undefined) {
        return (set.repsMin + set.repsMax) / 2;
    }
    if (set.repsMin !== undefined) {
        return set.repsMin;
    }
    if (set.repsMax !== undefined) {
        return set.repsMax;
    }
    // Fallback to a single reps value for routines without a range.
    if (set.reps !== undefined) {
        return set.reps;
    }
    return 0;
};

// Triggers a vibration on supported mobile devices.
export const vibrate = (pattern: number | number[] = 50) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
    }
};

// --- Body Composition Formulas ---

export const BodyFatAuthor = {
    PETROSKI: 'Petroski',
    JACKSON_POLLOCK: 'Jackson & Pollock (7 Dobras)',
    YMCA: 'YMCA (3 Dobras)',
    GUEDES: 'Guedes',
};

export interface FormulaResult {
    value: number | null;
    missing: string | null;
}

export interface BodyFatResult extends FormulaResult {
    fatMass: number | null;
    leanMass: number | null;
}

const createMissingFatResult = (missing: string): BodyFatResult => ({ value: null, fatMass: null, leanMass: null, missing });
const createInvalidFatResult = (): BodyFatResult => ({ value: null, fatMass: null, leanMass: null, missing: 'Cálculo inválido. Verifique os valores inseridos.' });

export const calculateBodyFatPetroski = (m: UserMeasurements): BodyFatResult => {
    const { gender, age, subscapularFold, tricepsFold, suprailiacFold, medialCalfFold, midaxillaryFold, thighFold, bodyMass } = m;
    if (!gender || !age || age <= 0) return createMissingFatResult('Gênero e idade são necessários.');
    let density;
    if (gender === Gender.MALE) {
        const s4Fields = [subscapularFold, tricepsFold, suprailiacFold, medialCalfFold];
        if (s4Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 4 dobras cutâneas (Subescapular, Tricipital, Suprailíaca, Panturrilha Medial) são necessárias e devem ser maiores que zero.');
        const s4 = s4Fields.reduce((sum, current) => sum! + current!, 0)!;
        density = 1.10726863 - (0.00081201 * s4) + (0.00000212 * (s4 * s4)) - (0.00041761 * age);
    } else { // FEMALE
        const s4Fields = [midaxillaryFold, suprailiacFold, thighFold, medialCalfFold];
        if (s4Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 4 dobras cutâneas (Axilar Média, Suprailíaca, Coxa Média, Panturrilha Medial) são necessárias e devem ser maiores que zero.');
        const s4 = s4Fields.reduce((sum, current) => sum! + current!, 0)!;
        if (s4 <= 0) return createMissingFatResult('A soma das dobras cutâneas deve ser positiva.');
        density = 1.19547130 - (0.07513507 * Math.log10(s4)) - (0.00041072 * age);
    }
    if (!density || density <= 0) return createInvalidFatResult();
    const bodyFatPercentage = ((4.95 / density) - 4.50) * 100;
    if (isNaN(bodyFatPercentage) || bodyFatPercentage < 0) return createInvalidFatResult();
    let fatMass = null, leanMass = null;
    if (bodyMass && bodyMass > 0) {
        fatMass = (bodyFatPercentage / 100) * bodyMass;
        leanMass = bodyMass - fatMass;
    }
    return { value: bodyFatPercentage, fatMass, leanMass, missing: null };
};

export const calculateBodyFatJacksonPollock = (m: UserMeasurements): BodyFatResult => {
    const { gender, age, subscapularFold, tricepsFold, pectoralFold, midaxillaryFold, suprailiacFold, abdominalFold, thighFold, abdominalPerimeter, forearmPerimeter, bodyMass } = m;
    if (!gender || !age || age <= 0) return createMissingFatResult('Gênero e idade são necessários.');
    const s7Fields = [subscapularFold, tricepsFold, pectoralFold, midaxillaryFold, suprailiacFold, abdominalFold, thighFold];
    if (s7Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 7 dobras cutâneas (Subescapular, Tricipital, Peitoral, Axilar Média, Suprailíaca, Abdominal, Coxa) são necessárias e devem ser maiores que zero.');
    const s7 = s7Fields.reduce((sum, current) => sum! + current!, 0)!;
    let dc;
    if (gender === Gender.MALE) {
        if (!abdominalPerimeter || abdominalPerimeter <= 0 || !forearmPerimeter || forearmPerimeter <= 0) return createMissingFatResult('Perímetro abdominal e do antebraço são necessários para o cálculo masculino e devem ser maiores que zero.');
        dc = 1.1010 - (0.00041150 * s7) + (0.00000069 * (s7 * s7)) - (0.00022631 * age) - (0.000059239 * abdominalPerimeter) + (0.000190632 * (forearmPerimeter / age));
    } else { // FEMALE
        dc = 1.0970 - (0.00046971 * s7) + (0.00000056 * (s7 * s7)) - (0.00012828 * age);
    }
    if (!dc || dc <= 0) return createInvalidFatResult();
    const bodyFatPercentage = ((4.95 / dc) - 4.50) * 100;
    if (isNaN(bodyFatPercentage) || bodyFatPercentage < 0) return createInvalidFatResult();
    let fatMass = null, leanMass = null;
    if (bodyMass && bodyMass > 0) {
        fatMass = (bodyFatPercentage / 100) * bodyMass;
        leanMass = bodyMass - fatMass;
    }
    return { value: bodyFatPercentage, fatMass, leanMass, missing: null };
};

export const calculateBodyFatYMCA = (m: UserMeasurements): BodyFatResult => {
    const { gender, age, tricepsFold, suprailiacFold, abdominalFold, bodyMass } = m;
    if (!gender || !age || age <= 0) return createMissingFatResult('Gênero e idade são necessários.');
    const s3Fields = [tricepsFold, suprailiacFold, abdominalFold];
    if (s3Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 3 dobras cutâneas (Tricipital, Suprailíaca, Abdominal) são necessárias e devem ser maiores que zero.');
    const s3 = s3Fields.reduce((sum, current) => sum! + current!, 0)!;
    let bodyFatPercentage;
    if (gender === Gender.MALE) {
        bodyFatPercentage = (0.39287 * s3) - (0.00105 * (s3 * s3)) + (0.15772 * age) - 5.18845;
    } else { // FEMALE
        bodyFatPercentage = (0.41563 * s3) - (0.00112 * (s3 * s3)) + (0.03661 * age) + 4.03653;
    }
    if (isNaN(bodyFatPercentage) || bodyFatPercentage < 0) return createInvalidFatResult();
    let fatMass = null, leanMass = null;
    if (bodyMass && bodyMass > 0) {
        fatMass = (bodyFatPercentage / 100) * bodyMass;
        leanMass = bodyMass - fatMass;
    }
    return { value: bodyFatPercentage, fatMass, leanMass, missing: null };
};

export const calculateBodyFatGuedes = (m: UserMeasurements): BodyFatResult => {
    const { gender, tricepsFold, suprailiacFold, abdominalFold, subscapularFold, thighFold, bodyMass } = m;
    if (!gender) return createMissingFatResult('Gênero é necessário.');
    let density;
    if (gender === Gender.MALE) {
        const s3Fields = [tricepsFold, suprailiacFold, abdominalFold];
        if (s3Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 3 dobras cutâneas (Tricipital, Suprailíaca, Abdominal) são necessárias e devem ser maiores que zero.');
        const s3 = s3Fields.reduce((sum, current) => sum! + current!, 0)!;
        if (s3 <= 0) return createMissingFatResult('A soma das dobras cutâneas deve ser positiva.');
        density = 1.17136 - 0.06706 * Math.log10(s3);
    } else { // FEMALE
        const s3Fields = [subscapularFold, suprailiacFold, thighFold];
        if (s3Fields.some(f => f === undefined || f <= 0)) return createMissingFatResult('As 3 dobras cutâneas (Subescapular, Suprailíaca, Coxa Média) são necessárias e devem ser maiores que zero.');
        const s3 = s3Fields.reduce((sum, current) => sum! + current!, 0)!;
        if (s3 <= 0) return createMissingFatResult('A soma das dobras cutâneas deve ser positiva.');
        density = 1.16650 - 0.07063 * Math.log10(s3);
    }
    if (!density || density <= 0) return createInvalidFatResult();
    const bodyFatPercentage = ((4.95 / density) - 4.50) * 100;
    if (isNaN(bodyFatPercentage) || bodyFatPercentage < 0) return createInvalidFatResult();
    let fatMass = null, leanMass = null;
    if (bodyMass && bodyMass > 0) {
        fatMass = (bodyFatPercentage / 100) * bodyMass;
        leanMass = bodyMass - fatMass;
    }
    return { value: bodyFatPercentage, fatMass, leanMass, missing: null };
};

export const calculateBoneWeight = (m: UserMeasurements): FormulaResult => {
    const { statureM, biStyloidPerimeter, biCondylarPerimeter } = m;
    if (!statureM || statureM <= 0) return { value: null, missing: 'Estatura (m) é necessária e deve ser maior que zero.' };
    if (!biStyloidPerimeter || biStyloidPerimeter <= 0) return { value: null, missing: 'Diâmetro bi-estilóide rádio-ulnar (cm) é necessário e deve ser maior que zero.' };
    if (!biCondylarPerimeter || biCondylarPerimeter <= 0) return { value: null, missing: 'Diâmetro bi-condiliano femural (cm) é necessário e deve ser maior que zero.' };
    const h = statureM, R_m = biStyloidPerimeter / 100, F_m = biCondylarPerimeter / 100;
    const base = Math.pow(h, 2) * R_m * F_m * 400;
    const boneWeightValue = 3.02 * Math.pow(base, 0.712);
    if (isNaN(boneWeightValue) || boneWeightValue <= 0) return { value: null, missing: 'Cálculo inválido. Verifique os valores inseridos.' };
    return { value: boneWeightValue, missing: null };
};

export const calculateResidualWeight = (m: UserMeasurements): FormulaResult => {
    const { gender, bodyMass } = m;
    if (!gender) return { value: null, missing: 'Gênero é necessário.' };
    if (!bodyMass || bodyMass <= 0) return { value: null, missing: 'Massa Corporal (kg) é necessária e deve ser maior que zero.' };
    const residualWeightValue = bodyMass * (gender === Gender.MALE ? 0.241 : 0.209);
    if (isNaN(residualWeightValue) || residualWeightValue <= 0) return { value: null, missing: 'Cálculo inválido. Verifique os valores inseridos.' };
    return { value: residualWeightValue, missing: null };
};

export const calculateMuscleWeight = (m: UserMeasurements, fatMassResult: FormulaResult, boneWeightResult: FormulaResult, residualWeightResult: FormulaResult): FormulaResult => {
    const { bodyMass } = m;
    if (!bodyMass || bodyMass <= 0) return { value: null, missing: 'Massa Corporal (kg) é necessária.' };
    if (fatMassResult.value === null) return { value: null, missing: `Massa Gorda: ${fatMassResult.missing}` };
    if (boneWeightResult.value === null) return { value: null, missing: `Peso Ósseo: ${boneWeightResult.missing}` };
    if (residualWeightResult.value === null) return { value: null, missing: `Peso Residual: ${residualWeightResult.missing}` };
    const muscleWeightValue = bodyMass - (fatMassResult.value + boneWeightResult.value + residualWeightResult.value);
    if (isNaN(muscleWeightValue) || muscleWeightValue <= 0) return { value: null, missing: 'Cálculo inválido ou resultado negativo. Verifique as estimativas.' };
    return { value: muscleWeightValue, missing: null };
};

// Main function to get all composition data
export const calculateAllBodyComposition = (measurements: UserMeasurements, fatAuthor: string) => {
    let fatCalcResult: BodyFatResult;

    switch (fatAuthor) {
        case BodyFatAuthor.JACKSON_POLLOCK: fatCalcResult = calculateBodyFatJacksonPollock(measurements); break;
        case BodyFatAuthor.YMCA: fatCalcResult = calculateBodyFatYMCA(measurements); break;
        case BodyFatAuthor.GUEDES: fatCalcResult = calculateBodyFatGuedes(measurements); break;
        default: fatCalcResult = calculateBodyFatPetroski(measurements); break;
    }
    
    const boneWeightResult = calculateBoneWeight(measurements);
    const residualWeightResult = calculateResidualWeight(measurements);
    const fatMassAsFormulaResult: FormulaResult = { value: fatCalcResult.fatMass, missing: fatCalcResult.missing };
    const muscleWeightResult = calculateMuscleWeight(measurements, fatMassAsFormulaResult, boneWeightResult, residualWeightResult);

    return {
        bodyMass: measurements.bodyMass || null,
        fatMass: fatCalcResult.fatMass,
        leanMass: fatCalcResult.leanMass,
        fatPercentage: fatCalcResult.value,
        boneWeight: boneWeightResult.value,
        residualWeight: residualWeightResult.value,
        muscleWeight: muscleWeightResult.value,
    };
};
