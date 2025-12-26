
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, Unit, MeasurementType, PerceivedExertionScale, ExerciseCategory } from '../types';
import { XIcon } from './Icons';
import { getScaleOptions } from '../constants';
import { parseEffortToNumber, formatSecondsToMMSS } from '../utils';
import { ChartData } from './Charts';

interface ExerciseInfoModalProps {
    exercise: Exercise;
    onClose: () => void;
}

interface BestSetDetails {
    reps: number;
    totalLoad: number;
    originalWeight: number;
    barbellWeight: number;
    isWeightDoubled: boolean;
    isCounterweight: boolean;
    effort: string;
    bodyMassAtTime?: number;
}

const repEstimationTableData = [
    { percentage: 100, reps: '1' },
    { percentage: 95, reps: '2' },
    { percentage: 90, reps: '3 a 4' },
    { percentage: 85, reps: '5 a 6' },
    { percentage: 80, reps: '7 a 8' },
    { percentage: 75, reps: '9 a 10' },
    { percentage: 70, reps: '11 a 12' },
];

const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({ exercise, onClose }) => {
    const { workouts, routines, evaluations } = useApp();

    const [selected1RMForTable, setSelected1RMForTable] = useState<number | null>(null);

    const youtubeId = useMemo(() => {
        if (!exercise.videoUrl) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = exercise.videoUrl.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }, [exercise.videoUrl]);

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
        let setDetails: BestSetDetails | null = null;
        const dailyMax1RMs = new Map<string, { max1RM: number; routineId: string }>();

        for (const session of completedWorkouts) {
            let sessionMax1RM = 0;
            for (const loggedEx of session.loggedExercises) {
                if (loggedEx.exerciseId === exercise.id) {
                    for (const set of loggedEx.sets) {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue < 9) continue;

                        const reps = set.reps ?? 0;
                        const originalWeight = set.value ?? 0;
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let totalLoad = originalWeight + barbellWeight;
                        
                        if (exercise.isWeightDoubled) totalLoad *= 2;
                        else if (exercise.isCounterweight && latestBodyMass && totalLoad > 0) totalLoad = Math.max(0, latestBodyMass - totalLoad);
                        
                        const current1RM = calculate1RM(reps, totalLoad);
                        if (current1RM > highest1RM) {
                            highest1RM = current1RM;
                            setDetails = {
                                reps,
                                totalLoad,
                                originalWeight,
                                barbellWeight,
                                isWeightDoubled: !!exercise.isWeightDoubled,
                                isCounterweight: !!exercise.isCounterweight,
                                effort: set.effort || '',
                                bodyMassAtTime: latestBodyMass
                            };
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
        if (highest1RM > 0 && setDetails) {
            overallStats = { type: 'resisted_1rm' as const, data: { estimated1RM: Math.round(highest1RM), details: setDetails } };
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

    useEffect(() => {
        if (resistanceStats.overallStats.type === 'resisted_1rm' && resistanceStats.overallStats.data) {
            setSelected1RMForTable(resistanceStats.overallStats.data.estimated1RM);
        } else {
            setSelected1RMForTable(null);
        }
    }, [resistanceStats.overallStats]);

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
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg border-2 border-primary/20">
                                    <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Carga Máxima Estimada (1RM)</p>
                                    <p className="text-5xl font-black text-primary">{stats.data.estimated1RM}<span className="text-2xl font-medium"> kg</span></p>
                                </div>
                                
                                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg space-y-3">
                                    <h4 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-tight border-b border-light-border dark:border-dark-border pb-1">Detalhamento do Registro</h4>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-light-text-secondary">Peso inserido:</span>
                                        <span className="font-bold text-lg">{stats.data.details.originalWeight} kg</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-light-text-secondary">Repetições:</span>
                                        <span className="font-bold text-lg">{stats.data.details.reps} reps</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-light-text-secondary">Esforço (PSE/RIR):</span>
                                        <span className="font-bold text-secondary">{stats.data.details.effort || 'Não inf.'}</span>
                                    </div>

                                    {/* Modificadores */}
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        {stats.data.details.barbellWeight > 0 && (
                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded uppercase">
                                                Barra: +{stats.data.details.barbellWeight}kg
                                            </span>
                                        )}
                                        {stats.data.details.isWeightDoubled && (
                                            <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-[10px] font-bold rounded uppercase">
                                                Peso 2x
                                            </span>
                                        )}
                                        {stats.data.details.isCounterweight && (
                                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold rounded uppercase">
                                                Contrapeso (Massa: {stats.data.details.bodyMassAtTime}kg)
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                                        <span className="text-xs font-semibold text-light-text-secondary uppercase">Carga Total Calculada:</span>
                                        <span className="font-black text-primary">{stats.data.details.totalLoad} kg</span>
                                    </div>
                                </div>

                                <div className="text-center text-[10px] text-light-text-secondary dark:text-dark-text-secondary italic px-4 leading-tight">
                                    *Cálculo O’Conner et al.: Carga x (1 + Reps/30). <br/>
                                    Considera apenas séries com esforço ≥ 9 para maior precisão.
                                </div>

                                <div className="mt-6 border-t border-light-border dark:border-dark-border pt-4">
                                    <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-3 text-center">Estimativa de Repetições vs. Carga</h4>
                                    
                                    {resistanceStats.fullHistory && resistanceStats.fullHistory.length > 0 && (
                                        <div className="mb-4">
                                            <label htmlFor="1rm-selector" className="block text-sm font-medium mb-1">Basear estimativa no 1RM de:</label>
                                            <select
                                                id="1rm-selector"
                                                value={selected1RMForTable ?? ''}
                                                onChange={(e) => setSelected1RMForTable(Number(e.target.value))}
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                            >
                                                <option value={stats.data.estimated1RM}>
                                                    Maior Registrado: {stats.data.estimated1RM} kg
                                                </option>
                                                {resistanceStats.fullHistory.slice().reverse().map((record, index) => (
                                                    <option key={`${record.date}-${index}`} value={record.value}>
                                                        {record.label}: {record.value} kg
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {selected1RMForTable && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                                                <thead className="text-xs text-light-text dark:text-dark-text uppercase bg-light-bg dark:bg-dark-bg">
                                                    <tr>
                                                        <th scope="col" className="px-4 py-2">% 1RM</th>
                                                        <th scope="col" className="px-4 py-2">Carga (kg)</th>
                                                        <th scope="col" className="px-4 py-2">Repetições Permitidas</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {repEstimationTableData.map(row => {
                                                        const calculatedLoad = (row.percentage / 100) * selected1RMForTable;
                                                        return (
                                                            <tr key={row.percentage} className="border-b border-light-border dark:border-dark-border last:border-b-0">
                                                                <td className="px-4 py-2 font-medium text-light-text dark:text-dark-text">{row.percentage}%</td>
                                                                <td className="px-4 py-2">{calculatedLoad.toFixed(1)}</td>
                                                                <td className="px-4 py-2">{row.reps}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
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
