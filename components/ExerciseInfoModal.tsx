import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, Unit, MeasurementType, PerceivedExertionScale, ExerciseCategory, WorkoutSession } from '../types';
import { XIcon, CalendarIcon, BarChartIcon } from './Icons';
import { getScaleOptions } from '../constants';
import { parseEffortToNumber, formatSecondsToMMSS } from '../utils';

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
    date: string;
    routineName: string;
}

interface CardioTestData {
    id: string;
    testType: string;
    date: string;
    value: number;
    unit: Unit;
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

const cardioZonesDefinition = [
    { label: 'Supramáximo', range: '> 100%', minFactor: 1.01, maxFactor: 1.20, color: 'text-red-800 dark:text-red-200', bgColor: 'bg-red-800' },
    { label: 'Máximo (100%)', range: '100%', minFactor: 1.0, maxFactor: 1.0, color: 'text-red-500', bgColor: 'bg-red-500' },
    { label: 'Severo', range: '85-99%', minFactor: 0.85, maxFactor: 0.99, color: 'text-orange-500', bgColor: 'bg-orange-500' },
    { label: 'Pesado', range: '63-84%', minFactor: 0.63, maxFactor: 0.84, color: 'text-amber-500', bgColor: 'bg-amber-500' },
    { label: 'Moderado', range: '45-62%', minFactor: 0.45, maxFactor: 0.62, color: 'text-emerald-500', bgColor: 'bg-emerald-500' },
    { label: 'Leve', range: '< 45%', minFactor: 0, maxFactor: 0.44, color: 'text-blue-500', bgColor: 'bg-blue-500' },
];

const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({ exercise, onClose }) => {
    const { workouts, routines, evaluations } = useApp();

    const youtubeId = useMemo(() => {
        if (!exercise.videoUrl) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = exercise.videoUrl.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }, [exercise.videoUrl]);

    // Resistance Data Logic
    const resistanceData = useMemo(() => {
        const completedWorkouts = workouts.filter(w => w.completed && w.date);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;

        if (exercise.category !== ExerciseCategory.RESISTED || exercise.unit !== Unit.KG) {
            return { history: [], absoluteBest: null };
        }

        const calculate1RM = (reps: number, load: number) => {
            if (reps <= 0 || load <= 0) return 0;
            if (reps === 1) return load;
            return load * (1 + reps / 30);
        };

        const dailyBestRecords = new Map<string, BestSetDetails>();
        let absoluteBest: BestSetDetails | null = null;

        for (const session of completedWorkouts) {
            let sessionBest: BestSetDetails | null = null;
            let sessionMax1RM = 0;

            for (const loggedEx of session.loggedExercises) {
                if (loggedEx.exerciseId === exercise.id) {
                    const routine = routines.find(r => r.id === session.routineId);
                    const routineName = routine?.name || (session.routineId === 'internal_test' ? 'Teste Físico' : 'Rotina Desconhecida');

                    for (const set of loggedEx.sets) {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue < 9.5) continue;

                        const reps = set.reps ?? 0;
                        const originalWeight = set.value ?? 0;
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let totalLoad = originalWeight + barbellWeight;
                        
                        if (exercise.isWeightDoubled) totalLoad *= 2;
                        else if (exercise.isCounterweight && latestBodyMass && totalLoad > 0) totalLoad = Math.max(0, latestBodyMass - totalLoad);
                        
                        const current1RM = calculate1RM(reps, totalLoad);
                        if (current1RM > sessionMax1RM) {
                            sessionMax1RM = current1RM;
                            sessionBest = {
                                reps,
                                totalLoad,
                                originalWeight,
                                barbellWeight,
                                isWeightDoubled: !!exercise.isWeightDoubled,
                                isCounterweight: !!exercise.isCounterweight,
                                effort: set.effort || '',
                                bodyMassAtTime: latestBodyMass,
                                date: session.date,
                                routineName
                            };
                        }
                    }
                }
            }

            if (sessionBest) {
                dailyBestRecords.set(session.date, sessionBest);
                if (!absoluteBest || calculate1RM(sessionBest.reps, sessionBest.totalLoad) > calculate1RM(absoluteBest.reps, absoluteBest.totalLoad)) {
                    absoluteBest = sessionBest;
                }
            }
        }

        const history = Array.from(dailyBestRecords.values())
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { history, absoluteBest };
    }, [exercise, workouts, routines, evaluations]);

    // Cardio Data Logic
    const cardioData = useMemo(() => {
        if (exercise.category !== ExerciseCategory.CARDIO) return { history: [], absoluteBest: null };

        const tests: CardioTestData[] = workouts
            .filter(w => w.completed && w.routineId === 'internal_test' && w.loggedExercises[0]?.exerciseId === exercise.id)
            .map(w => {
                const logEx = w.loggedExercises[0];
                const is5min = logEx.notes?.includes('5 minutos');
                const completedSets = logEx.sets.filter(s => s.completed);
                const val = is5min ? (logEx.sets[0].value ?? 0) : (completedSets[completedSets.length - 1]?.value ?? 0);
                return {
                    id: w.id,
                    testType: is5min ? '5 Minutos' : 'Incremental',
                    date: w.date,
                    value: val,
                    unit: exercise.unit
                };
            })
            .filter(t => t.value > 0)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const best = tests.length > 0 ? [...tests].sort((a, b) => b.value - a.value)[0] : null;

        return { history: tests, absoluteBest: best };
    }, [exercise, workouts]);

    // Flexibility Data Logic
    const flexibilityData = useMemo(() => {
        if (exercise.category !== ExerciseCategory.FLEXIBILITY || exercise.measurementType !== MeasurementType.TIME) return null;
        const completedWorkouts = workouts.filter(w => w.completed && w.date);
        let maxEffortValue = -1;
        let timeAtMaxEffort = 0;
        let maxEffortString = '';
        for (const session of completedWorkouts) {
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
            return { effortLabel, timeAtMaxEffort };
        }
        return null;
    }, [exercise, workouts]);

    // Selection States
    const [selectedRecord, setSelectedRecord] = useState<BestSetDetails | null>(null);
    const [selectedCardioTest, setSelectedCardioTest] = useState<CardioTestData | null>(null);

    useEffect(() => {
        if (resistanceData.absoluteBest) setSelectedRecord(resistanceData.absoluteBest);
    }, [resistanceData.absoluteBest]);

    useEffect(() => {
        if (cardioData.absoluteBest) setSelectedCardioTest(cardioData.absoluteBest);
    }, [cardioData.absoluteBest]);

    const estimated1RM = useMemo(() => {
        if (!selectedRecord) return 0;
        const { reps, totalLoad } = selectedRecord;
        if (reps === 1) return Math.round(totalLoad);
        return Math.round(totalLoad * (1 + reps / 30));
    }, [selectedRecord]);

    const handleRecordChange = (date: string) => {
        const record = resistanceData.history.find(r => r.date === date);
        if (record) setSelectedRecord(record);
        else if (date === 'absolute' && resistanceData.absoluteBest) setSelectedRecord(resistanceData.absoluteBest);
    };

    const handleCardioTestChange = (testId: string) => {
        const test = cardioData.history.find(t => t.id === testId);
        if (test) setSelectedCardioTest(test);
        else if (testId === 'absolute' && cardioData.absoluteBest) setSelectedCardioTest(cardioData.absoluteBest);
    };

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
                        {exercise.category === ExerciseCategory.RESISTED && exercise.unit === Unit.KG ? (
                            selectedRecord ? (
                                <>
                                    {resistanceData.history.length > 0 && (
                                        <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
                                            <label htmlFor="record-selector" className="block text-xs font-bold uppercase text-light-text-secondary mb-2">Analisar Desempenho de:</label>
                                            <select
                                                id="record-selector"
                                                value={selectedRecord.date === resistanceData.absoluteBest?.date ? 'absolute' : selectedRecord.date}
                                                onChange={(e) => handleRecordChange(e.target.value)}
                                                className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm font-semibold"
                                            >
                                                <option value="absolute">Recorde Histórico (Melhor de Sempre)</option>
                                                {resistanceData.history.map((record, index) => (
                                                    <option key={`${record.date}-${index}`} value={record.date}>
                                                        {new Date(`${record.date}T00:00:00`).toLocaleDateString('pt-BR')} - {record.routineName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg border-2 border-primary/20">
                                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Carga Máxima Estimada (1RM)</p>
                                        <p className="text-5xl font-black text-primary">{estimated1RM}<span className="text-2xl font-medium"> kg</span></p>
                                    </div>
                                    
                                    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg space-y-3">
                                        <h4 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-tight border-b border-light-border dark:border-dark-border pb-1">Detalhamento do Registro</h4>
                                        <div className="flex justify-between items-center"><span className="text-sm text-light-text-secondary">Data do Treino:</span><span className="font-bold">{new Date(`${selectedRecord.date}T00:00:00`).toLocaleDateString('pt-BR')}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-sm text-light-text-secondary">Peso inserido:</span><span className="font-bold text-lg">{selectedRecord.originalWeight} kg</span></div>
                                        <div className="flex justify-between items-center"><span className="text-sm text-light-text-secondary">Repetições:</span><span className="font-bold text-lg">{selectedRecord.reps} reps</span></div>
                                        <div className="flex justify-between items-center"><span className="text-sm text-light-text-secondary">Esforço (PSE/RIR):</span><span className="font-bold text-secondary">{selectedRecord.effort || 'Não inf.'}</span></div>

                                        <div className="pt-2 flex flex-wrap gap-2">
                                            {selectedRecord.barbellWeight > 0 && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded uppercase">Barra: +{selectedRecord.barbellWeight}kg</span>}
                                            {selectedRecord.isWeightDoubled && <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-[10px] font-bold rounded uppercase">Peso 2x</span>}
                                            {selectedRecord.isCounterweight && <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold rounded uppercase">Contrapeso (Massa: {selectedRecord.bodyMassAtTime}kg)</span>}
                                        </div>

                                        <div className="pt-2 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                                            <span className="text-xs font-semibold text-light-text-secondary uppercase">Carga Total Calculada:</span>
                                            <span className="font-black text-primary">{selectedRecord.totalLoad} kg</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 border-t border-light-border dark:border-dark-border pt-4">
                                        <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-3 text-center">Estimativa de Repetições vs. Carga</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                                                <thead className="text-xs text-light-text dark:text-dark-text uppercase bg-light-bg dark:bg-dark-bg">
                                                    <tr><th scope="col" className="px-4 py-2">% 1RM</th><th scope="col" className="px-4 py-2">Carga (kg)</th><th scope="col" className="px-4 py-2">Repetições Permitidas</th></tr>
                                                </thead>
                                                <tbody>
                                                    {repEstimationTableData.map(row => {
                                                        const calculatedLoad = (row.percentage / 100) * estimated1RM;
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
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-light-text-secondary dark:text-dark-text-secondary p-6 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p>Nenhum registro de alta intensidade encontrado para este exercício.</p>
                                    <p className="text-xs mt-2 italic">Para estimar o 1RM, registre séries com esforço (PSE/RIR) igual ou superior a 9.5.</p>
                                </div>
                            )
                        ) : exercise.category === ExerciseCategory.CARDIO ? (
                            selectedCardioTest ? (
                                <>
                                    {cardioData.history.length > 0 && (
                                        <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
                                            <label htmlFor="cardio-test-selector" className="block text-xs font-bold uppercase text-light-text-secondary mb-2">Usar Referência de:</label>
                                            <select
                                                id="cardio-test-selector"
                                                value={selectedCardioTest.id === cardioData.absoluteBest?.id ? 'absolute' : selectedCardioTest.id}
                                                onChange={(e) => handleCardioTestChange(e.target.value)}
                                                className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm font-semibold"
                                            >
                                                <option value="absolute">Melhor Teste Histórico</option>
                                                {cardioData.history.map((test) => (
                                                    <option key={test.id} value={test.id}>
                                                        {new Date(`${test.date}T00:00:00`).toLocaleDateString('pt-BR')} - {test.testType} ({test.value})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg border-2 border-secondary/20">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Referência Selecionada (100%): Teste {selectedCardioTest.testType}</p>
                                        <p className="text-4xl font-black text-secondary">{selectedCardioTest.value}<span className="text-xl font-medium"> {selectedCardioTest.unit}</span></p>
                                        <p className="text-[10px] text-light-text-secondary mt-1 flex items-center justify-center">
                                            <CalendarIcon className="h-3 w-3 mr-1" /> Realizado em {new Date(`${selectedCardioTest.date}T00:00:00`).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <h4 className="text-md font-bold text-center flex items-center justify-center">
                                            <BarChartIcon className="h-5 w-5 mr-2 text-primary" /> Zonas de Treinamento
                                        </h4>
                                        <div className="overflow-hidden rounded-lg border border-light-border dark:border-dark-border">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-light-bg dark:bg-gray-800 text-light-text-secondary uppercase">
                                                    <tr>
                                                        <th className="px-3 py-2">Zona</th>
                                                        <th className="px-3 py-2 text-center">% Ref</th>
                                                        <th className="px-3 py-2 text-right">Alvo ({selectedCardioTest.unit === Unit.NONE ? 'Intens.' : selectedCardioTest.unit})</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                                    {cardioZonesDefinition.map(zone => {
                                                        const minVal = (zone.minFactor * selectedCardioTest.value).toFixed(1);
                                                        const maxVal = (zone.maxFactor * selectedCardioTest.value).toFixed(1);
                                                        const displayTarget = zone.minFactor === zone.maxFactor 
                                                            ? `${minVal}` 
                                                            : zone.minFactor === 0 
                                                                ? `< ${maxVal}`
                                                                : zone.minFactor > 1 
                                                                    ? `> ${selectedCardioTest.value}`
                                                                    : `${minVal} - ${maxVal}`;

                                                        return (
                                                            <tr key={zone.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                                <td className="px-3 py-3">
                                                                    <div className="flex items-center">
                                                                        <span className={`w-2 h-2 rounded-full mr-2 ${zone.bgColor}`}></span>
                                                                        <span className={`font-semibold ${zone.color}`}>{zone.label}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3 text-center font-medium opacity-70">{zone.range}</td>
                                                                <td className="px-3 py-3 text-right font-black">{displayTarget}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-light-text-secondary dark:text-dark-text-secondary p-6 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p>Nenhum teste físico de referência encontrado para este exercício.</p>
                                    <p className="text-xs mt-2 italic">Realize um Teste de 5 Minutos ou Teste Incremental na seção de Ferramentas para gerar zonas de treinamento.</p>
                                </div>
                            )
                        ) : flexibilityData ? (
                            <>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Maior Esforço Registrado</p>
                                    <p className="text-xl font-bold text-primary px-2">{flexibilityData.effortLabel}</p>
                                </div>
                                <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Duração nesse Esforço</p>
                                    <p className="text-4xl font-bold text-secondary">{formatSecondsToMMSS(flexibilityData.timeAtMaxEffort)}</p>
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
                    <button onClick={onClose} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default ExerciseInfoModal;