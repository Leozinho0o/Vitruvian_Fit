

import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, Unit, MeasurementType, PerceivedExertionScale, ExerciseCategory } from '../types';
import { XIcon } from './Icons';
import { getScaleOptions } from '../constants';
import { parseEffortToNumber, formatSecondsToMMSS } from '../utils';
import { BarChart, ChartData } from './Charts';

interface ExerciseInfoModalProps {
    exercise: Exercise;
    onClose: () => void;
}

// Helper to format a date to 'YYYY-MM-DD'
const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({ exercise, onClose }) => {
    const { workouts, routines, evaluations } = useApp();

    // State for date filters
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const youtubeId = useMemo(() => {
        if (!exercise.videoUrl) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = exercise.videoUrl.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }, [exercise.videoUrl]);

    // This memo calculates all resistance stats, including the full history for the chart and the overall best stats.
    const resistanceStats = useMemo(() => {
        const completedWorkouts = workouts.filter(w => w.completed && w.date);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;

        if (exercise.category !== ExerciseCategory.RESISTED || exercise.unit !== Unit.KG) {
            return { fullHistory: [], overallStats: { type: 'none' as const, data: null } };
        }

        const calculate1RM = (reps: number, load: number) => {
            if (reps <= 0 || load <= 0) return 0;
            if (reps === 1) return load;
            return load * (1 + reps / 30);
        };
    
        let highest1RM = 0;
        let setForHighest1RM: { reps: number; weight: number } | null = null;
        const dailyMax1RMs = new Map<string, { max1RM: number; routineId: string }>();

        // Calculate daily max 1RM across all workouts with high effort
        for (const session of completedWorkouts) {
            let sessionMax1RM = 0;
            for (const loggedEx of session.loggedExercises) {
                if (loggedEx.exerciseId === exercise.id) {
                    for (const set of loggedEx.sets) {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue < 9) continue;

                        const reps = set.reps ?? 0;
                        const setWeight = set.value ?? 0;
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let totalLoad = setWeight + barbellWeight;
                        if (exercise.isWeightDoubled) totalLoad *= 2;
                        else if (exercise.isCounterweight && latestBodyMass && totalLoad > 0) totalLoad = Math.max(0, latestBodyMass - totalLoad);
                        
                        const current1RM = calculate1RM(reps, totalLoad);
                        if (current1RM > highest1RM) {
                            highest1RM = current1RM;
                            setForHighest1RM = { reps, weight: totalLoad };
                        }
                        if (current1RM > sessionMax1RM) sessionMax1RM = current1RM;
                    }
                }
            }
            if (sessionMax1RM > 0) {
                const dateKey = session.date;
                const existingEntry = dailyMax1RMs.get(dateKey);
                if (!existingEntry || sessionMax1RM > existingEntry.max1RM) {
                    dailyMax1RMs.set(dateKey, { max1RM: sessionMax1RM, routineId: session.routineId });
                }
            }
        }
    
        // Calculate overall stats for max weight (non-1RM case, no effort filter)
        let maxWeight = 0;
        let repsAtMaxWeight = 0;
        for (const session of completedWorkouts) {
            for (const loggedEx of session.loggedExercises) {
                if (loggedEx.exerciseId === exercise.id) {
                    for (const set of loggedEx.sets) {
                        const reps = set.reps ?? 0;
                        const setWeight = set.value ?? 0;
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let totalLoad = setWeight + barbellWeight;
                        if (exercise.isWeightDoubled) totalLoad *= 2;
                        else if (exercise.isCounterweight && latestBodyMass && totalLoad > 0) totalLoad = Math.max(0, latestBodyMass - totalLoad);
                        
                        if (totalLoad > maxWeight) {
                            maxWeight = totalLoad;
                            repsAtMaxWeight = reps;
                        } else if (totalLoad === maxWeight && totalLoad > 0) {
                            repsAtMaxWeight = Math.max(repsAtMaxWeight, reps);
                        }
                    }
                }
            }
        }

        let overallStats;
        if (highest1RM > 0 && setForHighest1RM) {
            overallStats = { type: 'resisted_1rm' as const, data: { estimated1RM: Math.round(highest1RM), set: setForHighest1RM } };
        } else if (maxWeight > 0) {
            overallStats = { type: 'resisted' as const, data: { maxWeight, repsAtMaxWeight } };
        } else {
            overallStats = { type: 'none' as const, data: null };
        }

        const fullHistory: (ChartData & { date: string })[] = Array.from(dailyMax1RMs.entries())
            .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
            .map(([date, data]) => {
                const routine = routines.find(r => r.id === data.routineId);
                const rounded1RM = Math.round(data.max1RM);
                return {
                    label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    value: rounded1RM,
                    details: [{ name: routine?.name || 'Rotina Desconhecida', value: rounded1RM, color: routine?.color || '#808080' }],
                    date,
                };
            });

        return { fullHistory, overallStats };
    }, [exercise, workouts, routines, evaluations]);

    // This effect sets the initial date range for the chart to the last 4 records
    useEffect(() => {
        if (resistanceStats.fullHistory.length > 0) {
            const history = resistanceStats.fullHistory;
            const endDate = history[history.length - 1].date;
            const startIndex = Math.max(0, history.length - 4);
            const startDate = history[startIndex].date;
            
            setStartDate(startDate);
            setEndDate(endDate);
        }
    }, [resistanceStats.fullHistory]);

    // This memo filters the chart data based on the selected date range
    const filteredHistoryData = useMemo(() => {
        if (!startDate || !endDate || !resistanceStats.fullHistory) return [];
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        return resistanceStats.fullHistory.filter(item => {
            const itemDate = new Date(`${item.date}T00:00:00`);
            return itemDate >= start && itemDate <= end;
        });
    }, [startDate, endDate, resistanceStats.fullHistory]);

    const otherStats = useMemo(() => {
        if (exercise.category === ExerciseCategory.RESISTED) return null;
        const completedWorkouts = workouts.filter(w => w.completed && w.date);
        switch (exercise.category) {
            case ExerciseCategory.CARDIO: {
                if (exercise.unit !== Unit.SPEED) return { type: 'none', data: null };
                let maxSpeed = 0;
                let timeAtMaxSpeed = 0;
                for (const session of completedWorkouts) {
                    for (const loggedEx of session.loggedExercises) {
                        if (loggedEx.exerciseId === exercise.id) {
                            for (const set of loggedEx.sets) {
                                const speed = set.value ?? 0;
                                const time = set.time ?? 0;
                                if (speed > maxSpeed) {
                                    maxSpeed = speed;
                                    timeAtMaxSpeed = time;
                                } else if (speed === maxSpeed && speed > 0) {
                                    timeAtMaxSpeed = Math.max(timeAtMaxSpeed, time);
                                }
                            }
                        }
                    }
                }
                if (maxSpeed > 0) return { type: 'cardio' as const, data: { maxSpeed, timeAtMaxSpeed } };
                return { type: 'none' as const, data: null };
            }
            case ExerciseCategory.FLEXIBILITY: {
                if (exercise.measurementType !== MeasurementType.TIME) return { type: 'none', data: null };
                let maxEffortValue = -1;
                let timeAtMaxEffort = 0;
                let maxEffortString = '';
                for (const session of completedWorkouts) {
                    if (!session.completed) continue;
                    for (const loggedEx of session.loggedExercises) {
                        if (loggedEx.exerciseId === exercise.id) {
                            for (const set of loggedEx.sets) {
                                const currentEffortValue = parseEffortToNumber(set.effort);
                                const time = set.time ?? 0;
                                if (currentEffortValue > maxEffortValue) {
                                    maxEffortValue = currentEffortValue;
                                    timeAtMaxEffort = time;
                                    maxEffortString = set.effort ?? '';
                                } else if (currentEffortValue === maxEffortValue && currentEffortValue > -1) {
                                    timeAtMaxEffort = Math.max(timeAtMaxEffort, time);
                                }
                            }
                        }
                    }
                }
                if (maxEffortValue > -1 && timeAtMaxEffort > 0) {
                    const scaleOptions = getScaleOptions(PerceivedExertionScale.PERFLEX);
                    const effortLabel = scaleOptions?.find(opt => opt.value === maxEffortString)?.label || maxEffortString;
                    return { type: 'flexibility' as const, data: { effortLabel, timeAtMaxEffort } };
                }
                return { type: 'none' as const, data: null };
            }
            default: return null;
        }
    }, [exercise, workouts]);

    const stats = resistanceStats.overallStats.type !== 'none' ? resistanceStats.overallStats : otherStats;
    const isResistedExercise = exercise.category === ExerciseCategory.RESISTED && exercise.unit === Unit.KG;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-lg text-light-text dark:text-dark-text shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">{exercise.name}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg" aria-label="Fechar">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div className="overflow-y-auto pr-2 space-y-6">
                    {exercise.imageUrl && (
                        <div className="w-full aspect-video bg-light-bg dark:bg-dark-bg rounded-lg overflow-hidden flex items-center justify-center">
                            <img src={exercise.imageUrl} alt={exercise.name} className="w-full h-full object-contain" />
                        </div>
                    )}
                    {youtubeId && (
                        <div className="w-full aspect-video bg-light-bg dark:bg-dark-bg rounded-lg overflow-hidden">
                            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="rounded-lg"></iframe>
                        </div>
                    )}
                    <div className="space-y-4">
                        {stats?.type === 'resisted_1rm' && stats.data ? (
                            <>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Estimativa de 1 Repetição Máxima (1RM)</p>
                                    <p className="text-4xl font-bold text-primary">{stats.data.estimated1RM}<span className="text-2xl font-medium"> kg</span></p>
                                </div>
                                <div className="text-center text-xs text-light-text-secondary dark:text-dark-text-secondary -mt-2 mb-2 px-4">
                                    *Cálculo baseado em séries com esforço (PSE/RIR) igual ou superior a 9.
                                </div>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Baseado no registro de</p>
                                    <p className="text-2xl font-bold text-secondary">{stats.data.set.weight}kg <span className="font-normal">para</span> {stats.data.set.reps} reps</p>
                                </div>
                            </>
                        ) : stats?.type === 'resisted' && stats.data ? (
                            <>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Maior Peso Registrado</p>
                                    <p className="text-4xl font-bold text-primary">{stats.data.maxWeight}<span className="text-2xl font-medium"> kg</span></p>
                                </div>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Repetições com esse Peso</p>
                                    <p className="text-4xl font-bold text-secondary">{stats.data.repsAtMaxWeight}<span className="text-2xl font-medium"> reps</span></p>
                                </div>
                            </>
                        ) : stats?.type === 'cardio' && stats.data ? (
                            <>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Maior Velocidade Registrada</p>
                                    <p className="text-4xl font-bold text-primary">{stats.data.maxSpeed}<span className="text-2xl font-medium"> km/h</span></p>
                                </div>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Tempo nessa Velocidade</p>
                                    <p className="text-4xl font-bold text-secondary">{formatSecondsToMMSS(stats.data.timeAtMaxSpeed)}</p>
                                </div>
                            </>
                        ) : stats?.type === 'flexibility' && stats.data ? (
                            <>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Maior Esforço Registrado</p>
                                    <p className="text-xl font-bold text-primary px-2">{stats.data.effortLabel}</p>
                                </div>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Duração nesse Esforço</p>
                                    <p className="text-4xl font-bold text-secondary">{formatSecondsToMMSS(stats.data.timeAtMaxEffort)}</p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary p-6 bg-light-bg dark:bg-dark-bg rounded-lg">
                                <p>Nenhum registro de treino relevante encontrado para este exercício.</p>
                                <p className="text-xs mt-2">Certifique-se de que o exercício foi configurado corretamente e que você já registrou treinos concluídos com ele.</p>
                            </div>
                        )}
                    </div>
                    
                    {isResistedExercise && resistanceStats.fullHistory.length > 0 && (
                        <div className="border-t border-light-border dark:border-dark-border pt-4">
                            <h4 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4 text-center">Evolução do 1RM Estimado</h4>
                            
                             <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4 px-4">
                                <div>
                                    <label htmlFor="startDate" className="block text-xs font-medium mb-1">De:</label>
                                    <input
                                        type="date"
                                        id="startDate"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                                        max={endDate}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="block text-xs font-medium mb-1">Até:</label>
                                    <input
                                        type="date"
                                        id="endDate"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                                        min={startDate}
                                        max={formatDateForInput(new Date())}
                                    />
                                </div>
                            </div>

                            <div className="h-64 pl-4 pr-2">
                                <BarChart data={filteredHistoryData} unit="kg" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-6 flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExerciseInfoModal;
