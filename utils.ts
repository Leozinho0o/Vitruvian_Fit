

import { WorkoutSet } from './types';

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
    if (set.reps !== undefined) return set.reps;
    if (set.repsMin !== undefined && set.repsMax !== undefined) {
        return (set.repsMin + set.repsMax) / 2;
    }
    return set.repsMin ?? set.repsMax ?? 0;
};

// Triggers a vibration on supported mobile devices.
export const vibrate = (pattern: number | number[] = 50) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
    }
};