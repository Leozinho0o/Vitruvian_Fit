
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, WorkoutSession, WorkoutSet, MeasurementType, Unit, PerceivedExertionScale, ExerciseCategory, Evaluation, PlannedExercise, SetType, CardioMethod, FlexibilityMethod } from '../types';
import { ChevronLeftIcon, PlusIcon, TrashIcon, XIcon, CheckCircleIcon, ChevronDownIcon, DumbbellIcon, InfoIcon, SearchIcon, MinimizeIcon, PlayIcon, HeartPulseIcon, StretchIcon, ChevronUpIcon, CopyIcon } from '../components/Icons';
import { getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, formatDuration, parseTimeToSeconds, vibrate } from '../utils';
import ExerciseInfoModal from '../components/ExerciseInfoModal';
import EffortPicker from '../components/EffortPicker';
import MethodPicker from '../components/MethodPicker';

// Time Input Component for better UX
interface TimeInputProps {
  id: string; 
  valueInSeconds: number | undefined;
  onChangeInSeconds: (seconds: number | undefined) => void;
  placeholder: string;
  className: string;
}

const TimeInput: React.FC<TimeInputProps> = ({ id, valueInSeconds, onChangeInSeconds, placeholder, className }) => {
    const [displayValue, setDisplayValue] = useState(() => formatSecondsToMMSS(valueInSeconds));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Only update display value from props if the input is not focused
        if (document.activeElement !== inputRef.current) {
            setDisplayValue(formatSecondsToMMSS(valueInSeconds));
        }
    }, [valueInSeconds]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const seconds = parseTimeToSeconds(e.target.value);
        onChangeInSeconds(seconds);
        // Re-format display value after blur
        setDisplayValue(formatSecondsToMMSS(seconds));
    };

    return (
        <input
            ref={inputRef}
            id={id}
            type="tel"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
        />
    );
};


const WorkoutSessionScreen: React.FC = () => {
    const { 
        activeWorkoutSession, 
        setActiveWorkoutSession, 
        setIsWorkoutMinimized,
        routines, 
        exercises, 
        workouts,
        updateWorkout,
        logWorkout,
        deleteWorkout,
        evaluations,
        setInfoModalContent,
        setIsPhysicalEvaluationScreenOpen
    } = useApp();
    
    // We use a ref for original plan to avoid placeholders changing if the session object is updated by typing
    const originalPlanRef = useRef(activeWorkoutSession?.originalPlan || []);
    
    const [now, setNow] = useState(() => Date.now());
    const [isTimerEditModalOpen, setIsTimerEditModalOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

    // Method Options
    const setTypeOptions = Object.values(SetType).map(t => ({ value: t, label: t }));
    const cardioOptions = Object.values(CardioMethod).map(m => ({ value: m, label: m }));
    const flexOptions = Object.values(FlexibilityMethod).map(m => ({ value: m, label: m }));

    const routine = useMemo(() => {
        if (activeWorkoutSession?.routineId === 'internal_test') {
            return { name: 'Teste de Desempenho' };
        }
        
        // 1. Try to find existing routine
        const foundRoutine = routines.find((r: any) => r.id === activeWorkoutSession?.routineId);
        
        // 2. Try to find snapshot in current active session
        if (!foundRoutine && activeWorkoutSession?.routineSnapshot) {
            return activeWorkoutSession.routineSnapshot;
        }

        // 3. Fallback
        return foundRoutine || { name: 'Rotina Arquivada', color: '#9CA3AF', notes: '' };
    }, [routines, activeWorkoutSession]);

    const elapsedTime = useMemo(() => {
        if (!activeWorkoutSession) return 0;
        
        if (activeWorkoutSession.completed && typeof activeWorkoutSession.duration === 'number') {
            return activeWorkoutSession.duration;
        }

        if (activeWorkoutSession.startTime) {
            const startTimestamp = new Date(activeWorkoutSession.startTime).getTime();
            return Math.floor((now - startTimestamp) / 1000);
        }

        return 0;
    }, [now, activeWorkoutSession]);

    useEffect(() => {
        if (!activeWorkoutSession || activeWorkoutSession.completed) {
            return;
        }
    
        const timerId = setInterval(() => {
            setNow(Date.now());
        }, 1000);
    
        return () => {
            clearInterval(timerId);
        };
    }, [activeWorkoutSession]);
    
    const handleAddExercise = (exerciseId: string) => {
        const exerciseToAdd = exercises.find(e => e.id === exerciseId);
        if (!exerciseToAdd) return;

        const hasBodyMass = evaluations.some((e: Evaluation) => e.measurements.bodyMass && e.measurements.bodyMass > 0);

        if (exerciseToAdd.isCounterweight && !hasBodyMass) {
            setInfoModalContent({
                title: 'Massa Corporal Necessária',
                message: 'Este exercício de contrapeso precisa da sua massa corporal. Por favor, insira este dado na sua avaliação física para continuar.',
                confirmText: "Ir para Avaliação",
                showCancelButton: true,
                cancelText: "Agora não",
                onConfirm: () => setIsPhysicalEvaluationScreenOpen(true)
            });
            setIsExercisePickerOpen(false);
            return;
        }

        const newLoggedExercise: PlannedExercise = {
            exerciseId,
            sets: [{}],
            notes: '',
            tempId: `le-${Date.now()}`
        };
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return { ...current, loggedExercises: [...current.loggedExercises, newLoggedExercise] };
        });
        setIsExercisePickerOpen(false);
    };
    
    const handleRemoveExercise = (tempIdToRemove: string) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return { ...current, loggedExercises: current.loggedExercises.filter(ex => ex.tempId !== tempIdToRemove) };
        });
    };

    const handleDuplicateLoggedExercise = (index: number) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            const exerciseToDuplicate = current.loggedExercises[index];
            const newExercise = {
                ...JSON.parse(JSON.stringify(exerciseToDuplicate)),
                tempId: `le-${Date.now()}-dup`
            };
            const newLoggedExercises = [...current.loggedExercises];
            newLoggedExercises.splice(index + 1, 0, newExercise);
            return { ...current, loggedExercises: newLoggedExercises };
        });
    };

    const handleExerciseNoteChange = (tempId: string, value: string) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return { ...current, loggedExercises: current.loggedExercises.map(log => log.tempId === tempId ? { ...log, notes: value } : log) };
        });
    };

    const handleExerciseMethodChange = (tempId: string, value: string) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return { ...current, loggedExercises: current.loggedExercises.map(log => log.tempId === tempId ? { ...log, method: value } : log) };
        });
    };

    const handleSetChange = (tempId: string, setIndex: number, field: keyof WorkoutSet, value: string) => {
        setActiveWorkoutSession((currentSession: WorkoutSession | null) => {
            if (!currentSession) return null;
            const newLoggedExercises = currentSession.loggedExercises.map(log => {
                if (log.tempId !== tempId) return log;
                const newSets = [...log.sets];
                const updatedSet = { ...(newSets[setIndex] || {}) };
                if (field === 'effort') {
                    (updatedSet as any)[field] = value === '' ? undefined : value;
                } else {
                    const numericValue = value === '' ? undefined : Number(value);
                    (updatedSet as any)[field] = numericValue;
                }
                newSets[setIndex] = updatedSet;
                return { ...log, sets: newSets };
            });
            return { ...currentSession, loggedExercises: newLoggedExercises };
        });
    };

    const handleBarbellWeightChange = (tempId: string, value: string) => {
        setActiveWorkoutSession((currentSession: WorkoutSession | null) => {
            if (!currentSession) return null;
            return {
                ...currentSession,
                loggedExercises: currentSession.loggedExercises.map(log => {
                    if (log.tempId !== tempId) return log;
                    const newWeight = value === '' ? undefined : Number(value);
                    return { ...log, barbellWeight: newWeight };
                })
            };
        });
    };
    
    const handleAddSet = (tempId: string) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return {
                ...current,
                loggedExercises: current.loggedExercises.map(log => log.tempId === tempId ? { ...log, sets: [...log.sets, {}] } : log)
            };
        });
    };
    
    const handleDeleteSet = (tempId: string, setIndex: number) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return {
                ...current,
                loggedExercises: current.loggedExercises.map(log => {
                    if (log.tempId !== tempId) return log;
                    const newSets = [...log.sets];
                    newSets.splice(setIndex, 1);
                    return { ...log, sets: newSets };
                })
            };
        });
    };

    const handleToggleSetComplete = (tempId: string, setIndex: number) => {
        setActiveWorkoutSession((currentSession: WorkoutSession | null) => {
            if (!currentSession) return null;
            const exerciseIndex = currentSession.loggedExercises.findIndex(l => l.tempId === tempId);
            if (exerciseIndex === -1) return currentSession;
    
            const originalSet = (currentSession.originalPlan || [])[exerciseIndex]?.sets[setIndex] || {};
            const exercise = exercises.find(e => e.id === currentSession.loggedExercises[exerciseIndex].exerciseId);
    
            const newLoggedExercises = currentSession.loggedExercises.map(log => {
                if (log.tempId !== tempId) return log;
    
                const newSets = [...log.sets];
                const set = { ...newSets[setIndex] };
                const isNowCompleting = !set.completed;
                set.completed = isNowCompleting;
                if (isNowCompleting) vibrate();
                
                // If filling automatically, only overwrite if currently undefined/null to avoid data loss during edits
                if (isNowCompleting) {
                    const isCountType = exercise?.measurementType === MeasurementType.COUNT;
                    if (isCountType) {
                        if (set.reps == null) set.reps = originalSet.repsMin ?? originalSet.reps;
                    } else {
                        if (set.time == null) set.time = originalSet.time;
                    }
                    if (set.value == null) set.value = originalSet.value;
                    if (set.effort == null) set.effort = originalSet.effort;
                }
                newSets[setIndex] = set;
                return { ...log, sets: newSets };
            });
            return { ...currentSession, loggedExercises: newLoggedExercises };
        });
    };

    const handleFinishWorkout = () => {
        if (!activeWorkoutSession) return;
        
        // Final clean: remove tempIds and filter out entirely empty sets
        const cleanedLoggedExercises = activeWorkoutSession.loggedExercises
            .map(({ tempId, ...log }) => ({
                ...log,
                sets: log.sets.filter(set => Object.values(set).some(v => v != null && v !== false && v !== ''))
            }))
            .filter(log => log.sets.length > 0);

        if (cleanedLoggedExercises.length === 0) {
            const isNewWorkout = activeWorkoutSession.id.startsWith('ws_temp_') || activeWorkoutSession.id.startsWith('ws_test_');
            if (window.confirm("Nenhum exercício foi registrado. O treino não será salvo. Deseja continuar?")) {
                if (!isNewWorkout) deleteWorkout(activeWorkoutSession.id);
                setActiveWorkoutSession(null);
                setIsWorkoutMinimized(false);
            }
            return;
        }

        // Se houver exercícios registrados, abre o modal de confirmação customizado
        setIsFinishConfirmOpen(true);
    };

    const confirmFinishWorkout = () => {
        if (!activeWorkoutSession) return;
        vibrate([100, 50, 100]);
        
        const cleanedLoggedExercises = activeWorkoutSession.loggedExercises
            .map(({ tempId, ...log }) => ({
                ...log,
                sets: log.sets.filter(set => Object.values(set).some(v => v != null && v !== false && v !== ''))
            }))
            .filter(log => log.sets.length > 0);

        const isNewWorkout = activeWorkoutSession.id.startsWith('ws_temp_') || activeWorkoutSession.id.startsWith('ws_test_');
        const workoutDuration = elapsedTime;

        if (isNewWorkout) {
            const { id, ...sessionData } = activeWorkoutSession;
            const finalSession: Omit<WorkoutSession, 'id'> = {
                ...sessionData,
                loggedExercises: cleanedLoggedExercises,
                endTime: new Date().toISOString(),
                completed: true,
                duration: workoutDuration,
            };
            logWorkout(finalSession);
        } else {
            const { ...sessionData } = activeWorkoutSession;
            const updatedSession: WorkoutSession = {
                ...sessionData,
                loggedExercises: cleanedLoggedExercises,
                endTime: new Date().toISOString(),
                completed: true,
                duration: workoutDuration,
            };
            updateWorkout(updatedSession);
        }
        setIsWorkoutMinimized(false);
        setIsFinishConfirmOpen(false);
    };
    
    const handleCancelWorkout = () => setIsCancelConfirmOpen(true);
    const confirmAndCancelWorkout = () => {
        setActiveWorkoutSession(null);
        setIsWorkoutMinimized(false);
        setIsCancelConfirmOpen(false);
    };

    const handleEditTimer = (newTimeInSeconds: number) => {
        if (!activeWorkoutSession) return;
        const newStartTime = new Date(Date.now() - newTimeInSeconds * 1000);
        setActiveWorkoutSession({
            ...activeWorkoutSession,
            startTime: newStartTime.toISOString(),
            duration: activeWorkoutSession.completed ? newTimeInSeconds : undefined,
        });
    };

    const handleResumeTimer = (currentSeconds: number) => {
        if (!activeWorkoutSession) return;
        vibrate();
        const newStartTime = new Date(Date.now() - currentSeconds * 1000);
        setActiveWorkoutSession({
            ...activeWorkoutSession,
            completed: false,
            endTime: null,
            duration: undefined,
            startTime: newStartTime.toISOString(),
        });
        setIsTimerEditModalOpen(false);
    };

    const handleMoveExerciseUp = (index: number) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current || index === 0) return current;
            const newLoggedExercises = [...current.loggedExercises];
            [newLoggedExercises[index - 1], newLoggedExercises[index]] = [newLoggedExercises[index], newLoggedExercises[index - 1]];
            return { ...current, loggedExercises: newLoggedExercises };
        });
    };

    const handleMoveExerciseDown = (index: number) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current || index === current.loggedExercises.length - 1) return current;
            const newLoggedExercises = [...current.loggedExercises];
            [newLoggedExercises[index + 1], newLoggedExercises[index]] = [newLoggedExercises[index], newLoggedExercises[index + 1]];
            return { ...current, loggedExercises: newLoggedExercises };
        });
    };

    if (!activeWorkoutSession || !routine) {
        return (
            <div className="p-4 text-center">
                <p>Erro: Sessão de treino ou rotina não encontrada.</p>
                <button onClick={() => setActiveWorkoutSession(null)} className="mt-4 bg-primary text-white p-2 rounded">
                    Voltar
                </button>
            </div>
        );
    }
    const loggedExercises = activeWorkoutSession.loggedExercises;

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding">
                 <button onClick={() => setIsWorkoutMinimized(true)} className="p-2 flex items-center justify-center" aria-label="Minimizar treino">
                    <MinimizeIcon className="h-6 w-6 text-light-text dark:text-dark-text" />
                 </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary -mb-1 truncate px-2 max-w-[150px]">{routine.name}</h1>
                    <button
                        onClick={() => setIsTimerEditModalOpen(true)}
                        className="text-xl font-bold text-secondary tabular-nums p-1 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
                        aria-label="Editar cronômetro"
                    >
                        <div aria-live="polite">{formatDuration(elapsedTime)}</div>
                    </button>
                </div>
                <button onClick={handleCancelWorkout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm whitespace-nowrap">
                    Cancelar
                </button>
            </header>
            <main className="flex-grow overflow-y-auto p-4 space-y-4">
                {'notes' in routine && routine.notes && (
                    <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg border-l-4" style={{borderColor: routine.color || '#DB2777'}}>
                        <h3 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Anotações da Rotina</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">"{routine.notes}"</p>
                    </div>
                )}
                {loggedExercises.map((loggedEx, exIndex) => {
                    const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                    if (!exercise) return null;
                    
                    const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);
                    const exerciseSets = loggedEx.sets || [];
                    const setsToRender = exerciseSets.length > 0 ? exerciseSets : [{}];
                    return (
                        <div
                            key={loggedEx.tempId}
                            className="bg-light-card dark:bg-dark-card p-4 rounded-lg space-y-4"
                        >
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    {exercise.category === ExerciseCategory.RESISTED && (
                                        <MethodPicker
                                            value={loggedEx.method || SetType.NORMAL}
                                            onChange={(val) => handleExerciseMethodChange(loggedEx.tempId!, val || '')}
                                            options={setTypeOptions}
                                            title="Selecionar Método"
                                            className={`text-sm font-bold ${
                                                loggedEx.method === SetType.WARM_UP ? 'text-yellow-600 dark:text-yellow-400' :
                                                (loggedEx.method && loggedEx.method !== SetType.NORMAL) ? 'text-secondary' : 
                                                'text-light-text dark:text-dark-text'
                                            }`}
                                        />
                                    )}
                                    {exercise.category === ExerciseCategory.CARDIO && (
                                        <MethodPicker
                                            value={loggedEx.method || undefined}
                                            onChange={(val) => handleExerciseMethodChange(loggedEx.tempId!, val || '')}
                                            options={cardioOptions}
                                            title="Selecionar Método Cardio"
                                            placeholder="Selecionar Método"
                                            className="text-sm font-bold text-light-text dark:text-dark-text"
                                        />
                                    )}
                                    {exercise.category === ExerciseCategory.FLEXIBILITY && (
                                        <MethodPicker
                                            value={loggedEx.method || undefined}
                                            onChange={(val) => handleExerciseMethodChange(loggedEx.tempId!, val || '')}
                                            options={flexOptions}
                                            title="Selecionar Método Flexibilidade"
                                            placeholder="Selecionar Método"
                                            className="text-sm font-bold text-light-text dark:text-dark-text"
                                        />
                                    )}
                                    {/* Icons Row */}
                                    <div className="flex items-center justify-end gap-1 ml-auto">
                                        <button type="button" onClick={() => handleRemoveExercise(loggedEx.tempId!)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Remover ${exercise.name} do treino`}>
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => handleDuplicateLoggedExercise(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Duplicar">
                                            <CopyIcon className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => setInfoExercise(exercise)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Informações sobre ${exercise.name}`}>
                                            <InfoIcon className="h-5 w-5" />
                                        </button>
                                        <div className="flex gap-1">
                                            {exIndex > 0 && (
                                                <button type="button" onClick={() => handleMoveExerciseUp(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Mover para cima">
                                                    <ChevronUpIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                            {exIndex < loggedExercises.length - 1 && (
                                                <button type="button" onClick={() => handleMoveExerciseDown(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Mover para baixo">
                                                    <ChevronDownIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-12 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center">
                                            {exercise.imageUrl ? (
                                                <img
                                                    src={exercise.imageUrl}
                                                    alt={exercise.name}
                                                    className="w-full h-full object-cover rounded-md"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <DumbbellIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">{exercise.name}</h3>
                                            {exercise.isCounterweight && (<span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Contrapeso</span>)}
                                            {exercise.includeBarbellWeight && (<span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Peso da Barra</span>)}
                                            {exercise.isWeightDoubled && (<span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Peso 2x</span>)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <textarea
                                value={loggedEx.notes || ''}
                                onChange={(e) => handleExerciseNoteChange(loggedEx.tempId!, e.target.value)}
                                placeholder="Anotações do treino para este exercício..."
                                rows={2}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                            />
                            {exercise.includeBarbellWeight && (
                                <div className="mt-3">
                                    <label htmlFor={`barbell-${loggedEx.tempId}`} className="block text-sm font-medium mb-1">Peso da Barra (kg)</label>
                                    <input
                                        type="number"
                                        id={`barbell-${loggedEx.tempId}`}
                                        inputMode="decimal"
                                        step="any"
                                        value={loggedEx.barbellWeight ?? ''}
                                        placeholder={(originalPlanRef.current[exIndex]?.barbellWeight ?? '').toString()}
                                        onChange={(e) => handleBarbellWeightChange(loggedEx.tempId!, e.target.value)}
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                    />
                                </div>
                            )}
                            <div className="space-y-3">
                                {setsToRender.map((set, setIndex) => {
                                    const originalSet = originalPlanRef.current[exIndex]?.sets[setIndex] || {};
                                    const isCountType = exercise.measurementType === MeasurementType.COUNT;
                                    
                                    let repsTimePlaceholder = isCountType ? ((originalSet.repsMin !== undefined || originalSet.repsMax !== undefined) ? `${originalSet.repsMin ?? ''}-${originalSet.repsMax ?? ''}` : originalSet.reps?.toString() ?? '') : (formatSecondsToMMSS(originalSet.time) || "MM:SS");
                                    const valuePlaceholder = originalSet.value?.toString() ?? '';
                                    const effortFromPlan = originalSet.effort;

                                    return (
                                        <div key={setIndex} className={`bg-light-bg dark:bg-dark-bg p-3 rounded-lg space-y-3 transition-opacity ${set.completed ? 'opacity-50' : ''}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleToggleSetComplete(loggedEx.tempId!, setIndex)}>
                                                        <input type="checkbox" aria-label={`Marcar série ${setIndex + 1} como completa`} checked={!!set.completed} readOnly className="h-5 w-5 rounded text-secondary bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border focus:ring-secondary focus:ring-2 cursor-pointer" />
                                                        <span className={`font-bold text-lg text-light-text dark:text-dark-text ${set.completed ? 'line-through' : ''}`}>
                                                        {activeWorkoutSession.id.startsWith('ws_test_inc') ? `Estágio ${setIndex + 1}` : `Série ${setIndex + 1}`}
                                                        </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleDeleteSet(loggedEx.tempId!, setIndex)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Deletar série ${setIndex + 1}`}>
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-end gap-3">
                                                <div className="grow-[2] shrink basis-[80px]">
                                                    <label className="block text-xs font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{isCountType ? 'Repetições' : 'Tempo'}</label>
                                                    {isCountType ? (
                                                        <input type="number" inputMode="numeric" aria-label={`Repetições para série ${setIndex + 1}`} placeholder={repsTimePlaceholder} value={set.reps ?? ''} onFocus={(e) => e.target.select()} onChange={e => handleSetChange(loggedEx.tempId!, setIndex, 'reps', e.target.value)} className={`w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-center text-light-text dark:text-dark-text transition-colors duration-300 ${set.completed ? 'line-through' : ''}`} />
                                                    ) : (
                                                        <TimeInput id={`session-time-input-${loggedEx.tempId}-${setIndex}`} valueInSeconds={set.time} onChangeInSeconds={(seconds) => handleSetChange(loggedEx.tempId!, setIndex, 'time', seconds?.toString() ?? '')} placeholder={repsTimePlaceholder} className={`w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-center text-light-text dark:text-dark-text transition-colors duration-300 ${set.completed ? 'line-through' : ''}`} />
                                                    )}
                                                </div>
                                                {exercise.unit !== Unit.NONE &&
                                                    <div className="grow-[2] shrink basis-[80px]">
                                                        <label className="block text-xs font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{exercise.unit}</label>
                                                        <input type="number" aria-label={`Peso para série ${setIndex + 1}`} placeholder={valuePlaceholder} value={set.value ?? ''} onFocus={(e) => e.target.select()} onChange={e => handleSetChange(loggedEx.tempId!, setIndex, 'value', e.target.value)} className={`w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-center text-light-text dark:text-dark-text transition-colors duration-300 ${set.completed ? 'line-through' : ''}`} />
                                                    </div>
                                                }
                                                    {scaleOptions && (
                                                    <div className="w-[75px] shrink-0">
                                                        <label className="block text-xs font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">Esforço</label>
                                                        <div className="h-10">
                                                            <EffortPicker value={set.effort} onChange={(val) => handleSetChange(loggedEx.tempId!, setIndex, 'effort', val === undefined ? '' : val)} options={scaleOptions} placeholder={effortFromPlan ? `Sug: ${effortFromPlan}` : 'PSE'} disabled={!!set.completed} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <button onClick={() => handleAddSet(loggedEx.tempId!)} className="w-full mt-2 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center text-sm">
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Adicionar Série
                            </button>
                        </div>
                    );
                })}
                 <button type="button" onClick={() => setIsExercisePickerOpen(true)} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center">
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Adicionar Exercício
                </button>
            </main>
            <footer className="flex-shrink-0 bg-light-card dark:bg-dark-card p-4 border-t border-light-border dark:border-dark-border safe-bottom-padding">
                 <button onClick={handleFinishWorkout} className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center text-lg">
                    <CheckCircleIcon className="h-6 w-6 mr-2" />
                    Concluir Treino
                </button>
            </footer>
            {isExercisePickerOpen && (<ExercisePickerModal onClose={() => setIsExercisePickerOpen(false)} onSelect={handleAddExercise} allExercises={exercises} />)}
            {isCancelConfirmOpen && (<ConfirmationModal isOpen={isCancelConfirmOpen} onClose={() => setIsCancelConfirmOpen(false)} onConfirm={confirmAndCancelWorkout} title="Cancelar Treino" message="Tem certeza que deseja cancelar o treino? O progresso não salvo será perdido." confirmText="Sim" cancelText="Não" />)}
            {isFinishConfirmOpen && (<ConfirmationModal isOpen={isFinishConfirmOpen} onClose={() => setIsFinishConfirmOpen(false)} onConfirm={confirmFinishWorkout} title="Concluir Treino" message="Deseja finalizar e salvar este treino?" confirmText="Sim, Concluir" cancelText="Ainda não" variant="info" />)}
            {isTimerEditModalOpen && (<TimerEditModal isOpen={isTimerEditModalOpen} onClose={() => setIsTimerEditModalOpen(false)} onSave={handleEditTimer} onResume={handleResumeTimer} initialTime={elapsedTime} isCompleted={!!activeWorkoutSession.completed} />)}
            {infoExercise && (<ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />)}
        </div>
    );
};

const ExercisePickerModal = ({ onClose, onSelect, allExercises }: { onClose: () => void; onSelect: (exerciseId: string) => void; allExercises: Exercise[]; }) => {
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | null>(null);

    const filteredExercises = useMemo(() => {
        const queryLower = query.toLowerCase().trim();
        return allExercises.filter(ex => {
            const searchMatch = !queryLower || ex.name.toLowerCase().includes(queryLower);
            const categoryMatch = !categoryFilter || ex.category === categoryFilter;
            return searchMatch && categoryMatch;
        }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [allExercises, query, categoryFilter]);

    const exercisesByCategory = useMemo(() => {
        return filteredExercises.reduce((acc, exercise) => {
            if (!acc[exercise.category]) acc[exercise.category] = [];
            acc[exercise.category].push(exercise);
            return acc;
        }, {} as Record<ExerciseCategory, Exercise[]>);
    }, [filteredExercises]);

    const categoryFilterOptions: { label: string; value: ExerciseCategory | null; icon: React.ReactNode }[] = [
        { label: 'Todos', value: null, icon: null },
        { label: 'Resistido', value: ExerciseCategory.RESISTED, icon: <DumbbellIcon className="h-4 w-4 mr-1" /> },
        { label: 'Cardio', value: ExerciseCategory.CARDIO, icon: <HeartPulseIcon className="h-4 w-4 mr-1" /> },
        { label: 'Flex', value: ExerciseCategory.FLEXIBILITY, icon: <StretchIcon className="h-4 w-4 mr-1" /> }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">Selecionar Exercício</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div className="space-y-4 mb-4 flex-shrink-0">
                    <div className="relative">
                        <SearchIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary" />
                        <input 
                            type="text" 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            placeholder="Pesquisar..." 
                            className="w-full bg-light-bg dark:bg-dark-border border border-light-border dark:border-dark-border rounded-md pl-10 pr-4 py-2 text-sm" 
                            autoFocus 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1 bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                        {categoryFilterOptions.map(option => (
                            <button
                                key={option.label}
                                type="button"
                                onClick={() => setCategoryFilter(option.value)}
                                className={`flex items-center justify-center p-2 rounded-md text-xs font-bold transition-all ${
                                    categoryFilter === option.value
                                        ? 'bg-primary text-white shadow-md'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card'
                                }`}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                    {Object.keys(exercisesByCategory).length > 0 ? (
                        (Object.entries(exercisesByCategory) as [string, Exercise[]][]).map(([category, items]) => (
                            <div key={category}>
                                <h4 className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-2 sticky top-0 bg-light-card dark:bg-dark-card py-1 z-10">
                                    {category}
                                </h4>
                                <div className="space-y-2">
                                    {items.map(ex => (
                                        <button 
                                            key={ex.id} 
                                            onClick={() => onSelect(ex.id)} 
                                            className="w-full text-left p-2 rounded-md flex items-center gap-3 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors border border-transparent hover:border-light-border dark:hover:border-dark-border"
                                        >
                                            <div className="w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-md flex items-center justify-center flex-shrink-0">
                                                {ex.imageUrl ? (
                                                    <img src={ex.imageUrl} className="w-full h-full object-cover rounded-md" alt={ex.name} />
                                                ) : (
                                                    <DumbbellIcon className="h-6 w-6 text-light-text-secondary" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-semibold block text-sm whitespace-normal leading-tight">{ex.name}</span>
                                                <span className="text-[10px] text-light-text-secondary truncate block">{ex.primaryMuscles.join(', ')}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-sm text-light-text-secondary">Nenhum exercício encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TimerEditModal = ({ isOpen, onClose, onSave, onResume, initialTime, isCompleted }: { isOpen: boolean; onClose: () => void; onSave: (seconds: number) => void; onResume: (seconds: number) => void; initialTime: number; isCompleted: boolean; }) => {
    const [hours, setHours] = useState(Math.floor(initialTime / 3600));
    const [minutes, setMinutes] = useState(Math.floor((initialTime % 3600) / 60));
    const [seconds, setSeconds] = useState(initialTime % 60);

    if (!isOpen) return null;

    const getTotalSeconds = () => {
        return (hours * 3600) + (minutes * 60) + seconds;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-xs shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-center">Editar Tempo</h3>
                <div className="flex justify-center items-center gap-2 mb-6">
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 p-2 text-center text-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md"
                        />
                        <span className="text-xs text-light-text-secondary mt-1">h</span>
                    </div>
                    <span className="text-xl font-bold">:</span>
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            value={minutes}
                            onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 p-2 text-center text-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md"
                        />
                        <span className="text-xs text-light-text-secondary mt-1">m</span>
                    </div>
                    <span className="text-xl font-bold">:</span>
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            value={seconds}
                            onChange={(e) => setSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 p-2 text-center text-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md"
                        />
                        <span className="text-xs text-light-text-secondary mt-1">s</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <button onClick={() => { onSave(getTotalSeconds()); onClose(); }} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md">
                        Salvar Tempo
                    </button>
                    {isCompleted && (
                        <button onClick={() => { onResume(getTotalSeconds()); }} className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">
                            Retomar Treino
                        </button>
                    )}
                    <button onClick={onClose} className="w-full bg-gray-200 dark:bg-gray-700 text-light-text dark:text-dark-text font-bold py-2 px-4 rounded-md">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkoutSessionScreen;