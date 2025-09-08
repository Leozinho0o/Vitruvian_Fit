import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, WorkoutSession, LoggedExercise, WorkoutSet, MeasurementType, Unit, PerceivedExertionScale, ExerciseCategory, Evaluation, PlannedExercise } from '../types';
import { ChevronLeftIcon, PlusIcon, TrashIcon, XIcon, CheckCircleIcon, ChevronDownIcon, DumbbellIcon, InfoIcon, GripVerticalIcon, SearchIcon } from '../components/Icons';
import { getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, formatDuration, parseTimeToSeconds, vibrate } from '../utils';
import ExerciseInfoModal from '../components/ExerciseInfoModal';
import EffortPicker from '../components/EffortPicker';

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
    
    const originalPlanRef = useRef(activeWorkoutSession?.originalPlan || []);
    
    const [now, setNow] = useState(() => Date.now());
    const [isTimerEditModalOpen, setIsTimerEditModalOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{targetId: string, position: 'top' | 'bottom'} | null>(null);
    
    const scrollContainerRef = useRef<HTMLElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
    const lastClientY = useRef<number>(0);
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

    const routine = useMemo(() => 
        routines.find(r => r.id === activeWorkoutSession?.routineId),
    [routines, activeWorkoutSession]);

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
    
    const historicalData = useMemo(() => {
        if (!activeWorkoutSession) return new Map<string, LoggedExercise>();

        const historyMap = new Map<string, LoggedExercise>();
        const relevantExerciseIds = activeWorkoutSession.loggedExercises.map(ex => ex.exerciseId);
        
        const completedWorkouts = workouts
            .filter((w: WorkoutSession) => w.completed && w.date)
            .sort((a: WorkoutSession, b: WorkoutSession) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const exerciseId of relevantExerciseIds) {
            if (historyMap.has(exerciseId)) continue;

            for (const workout of completedWorkouts) {
                const loggedEx = workout.loggedExercises.find(le => le.exerciseId === exerciseId);
                if (loggedEx && loggedEx.sets.length > 0) {
                    historyMap.set(exerciseId, loggedEx);
                    break;
                }
            }
        }
        return historyMap;
    }, [activeWorkoutSession, workouts]);

    const scrollLoop = () => {
        if (scrollDirectionRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const rect = container.getBoundingClientRect();
            
            const hotZoneHeight = 60;
            const maxSpeed = 15;
            const minSpeed = 1;

            let speed = 0;
            const y = lastClientY.current - rect.top;

            if (scrollDirectionRef.current === 'up') {
                const proximity = (hotZoneHeight - y) / hotZoneHeight;
                if (proximity > 0) {
                   const additionalSpeed = (maxSpeed - minSpeed) * Math.pow(proximity, 3);
                   speed = -(minSpeed + additionalSpeed);
                }
            } else if (scrollDirectionRef.current === 'down') {
                const proximity = (y - (rect.height - hotZoneHeight)) / hotZoneHeight;
                if (proximity > 0) {
                    const additionalSpeed = (maxSpeed - minSpeed) * Math.pow(proximity, 2);
                    speed = minSpeed + additionalSpeed;
                }
            }

            if (speed !== 0) {
                container.scrollTop += speed;
                scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
            } else {
                stopScrolling();
            }
        }
    };

    const stopScrolling = () => {
        if (scrollIntervalRef.current) {
            cancelAnimationFrame(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
        scrollDirectionRef.current = null;
    };
    
    const handleContainerDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggingId || !scrollContainerRef.current) return;
        
        lastClientY.current = e.clientY;

        const container = scrollContainerRef.current;
        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;

        const hotZoneHeight = 60;

        if (y < hotZoneHeight) {
            if (scrollDirectionRef.current !== 'up') {
                stopScrolling();
                scrollDirectionRef.current = 'up';
                scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
            }
        } else if (y > rect.height - hotZoneHeight) {
            if (scrollDirectionRef.current !== 'down') {
                stopScrolling();
                scrollDirectionRef.current = 'down';
                scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
            }
        } else {
            stopScrolling();
        }

        const directTarget = e.target as HTMLElement;
        const targetElement = directTarget.closest('[data-drag-id]') as HTMLElement | null;

        if (!targetElement) return;

        const targetId = targetElement.dataset.dragId;
        if (!targetId || targetId === draggingId) return;

        const targetRect = targetElement.getBoundingClientRect();
        const midpointY = targetRect.top + targetRect.height / 2;
        const position = e.clientY < midpointY ? 'top' : 'bottom';

        if (dropIndicator?.targetId !== targetId || dropIndicator?.position !== position) {
            setDropIndicator({ targetId, position });
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        if (!draggingId || !dropIndicator) {
            handleDragEnd();
            return;
        }

        const { targetId, position } = dropIndicator;
        
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            const prev = current.loggedExercises;
            const draggedItem = prev.find(p => p.tempId === draggingId);
            if (!draggedItem) return current;

            const items = prev.filter(p => p.tempId !== draggingId);
            let targetIndex = items.findIndex(p => p.tempId === targetId);
            if (targetIndex === -1) return current;
            
            if (position === 'bottom') targetIndex++;
            items.splice(targetIndex, 0, draggedItem);
            return { ...current, loggedExercises: items };
        });
        handleDragEnd();
    };

    const handleDragStart = (e: React.DragEvent, tempId: string) => {
        setDraggingId(tempId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tempId);
    };

    const handleDragEnd = () => {
        stopScrolling();
        setDraggingId(null);
        setDropIndicator(null);
    };

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

        const newLoggedExercise: LoggedExercise = {
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

    const handleExerciseNoteChange = (tempId: string, value: string) => {
        setActiveWorkoutSession((current: WorkoutSession | null) => {
            if (!current) return null;
            return { ...current, loggedExercises: current.loggedExercises.map(log => log.tempId === tempId ? { ...log, notes: value } : log) };
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
                    updatedSet.effort = value === '' ? undefined : value;
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
                
                if (isNowCompleting) {
                    const isCountType = exercise?.measurementType === MeasurementType.COUNT;
                    if (isCountType) {
                        if (set.reps === undefined) set.reps = originalSet.repsMin ?? originalSet.reps;
                    } else {
                        if (set.time === undefined) set.time = originalSet.time;
                    }
                    if (set.value === undefined) set.value = originalSet.value;
                    if (set.effort === undefined) set.effort = originalSet.effort;
                }
                newSets[setIndex] = set;
                return { ...log, sets: newSets };
            });
            return { ...currentSession, loggedExercises: newLoggedExercises };
        });
    };

    const handleFinishWorkout = () => {
        if (!activeWorkoutSession) return;
        vibrate([100, 50, 100]);
        const cleanedLoggedExercises = activeWorkoutSession.loggedExercises
            .map(({ tempId, ...log }) => ({
                ...log,
                sets: log.sets.filter(set => Object.values(set).some(v => v != null && v !== false && v !== ''))
            }))
            .filter(log => log.sets.length > 0);

        const isNewWorkout = activeWorkoutSession.id.startsWith('ws_temp_');
        const workoutDuration = elapsedTime;

        if (cleanedLoggedExercises.length === 0) {
            if (window.confirm("Nenhum exercício foi registrado. O treino não será salvo. Deseja continuar?")) {
                if (!isNewWorkout) deleteWorkout(activeWorkoutSession.id);
                setActiveWorkoutSession(null);
            }
            return;
        }
        
        if (isNewWorkout) {
            const { id, originalPlan, ...sessionData } = activeWorkoutSession;
            const finalSession: Omit<WorkoutSession, 'id'> = {
                ...sessionData,
                loggedExercises: cleanedLoggedExercises,
                endTime: new Date().toISOString(),
                completed: true,
                duration: workoutDuration,
            };
            logWorkout(finalSession);
        } else {
            const { originalPlan, ...sessionData } = activeWorkoutSession;
            const updatedSession: WorkoutSession = {
                ...sessionData,
                loggedExercises: cleanedLoggedExercises,
                endTime: new Date().toISOString(),
                completed: true,
                duration: workoutDuration,
            };
            updateWorkout(updatedSession);
        }
    };
    
    const handleCancelWorkout = () => setIsCancelConfirmOpen(true);
    const confirmAndCancelWorkout = () => {
        setActiveWorkoutSession(null);
        setIsCancelConfirmOpen(false);
    };

    const handleEditTimer = (newTimeInSeconds: number) => {
        if (!activeWorkoutSession) return;
        const newStartTime = new Date(Date.now() - newTimeInSeconds * 1000);
        setActiveWorkoutSession({
            ...activeWorkoutSession,
            startTime: newStartTime.toISOString(),
            duration: undefined,
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
                 <button onClick={handleCancelWorkout} className="p-2 flex items-center justify-center" aria-label="Voltar">
                    <ChevronLeftIcon className="h-6 w-6 text-light-text dark:text-dark-text" />
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary -mb-1 truncate px-2">{routine.name}</h1>
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
            <main
                ref={scrollContainerRef}
                onDragOver={handleContainerDragOver}
                onDrop={handleDrop}
                className="flex-grow overflow-y-auto p-4 space-y-4"
            >
                {routine.notes && (
                    <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg border-l-4" style={{borderColor: routine.color}}>
                        <h3 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Anotações da Rotina</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">"{routine.notes}"</p>
                    </div>
                )}
                {loggedExercises.map((loggedEx, exIndex) => {
                    const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                    if (!exercise) return null;
                    
                    const lastLoggedExercise = historicalData.get(exercise.id);
                    const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);
                    const exerciseSets = loggedEx.sets || [];
                    const setsToRender = exerciseSets.length > 0 ? exerciseSets : [{}];
                    return (
                        <React.Fragment key={loggedEx.tempId}>
                            {dropIndicator && dropIndicator.targetId === loggedEx.tempId && dropIndicator.position === 'top' && (
                                <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                            )}
                            <div
                                data-drag-id={loggedEx.tempId}
                                draggable
                                onDragStart={(e) => handleDragStart(e, loggedEx.tempId!)}
                                onDragEnd={handleDragEnd}
                                className={`bg-light-card dark:bg-dark-card p-4 rounded-lg space-y-4 cursor-grab transition-opacity ${draggingId === loggedEx.tempId ? 'opacity-40' : 'opacity-100'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <GripVerticalIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
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
                                        <button type="button" onClick={() => setInfoExercise(exercise)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Informações sobre ${exercise.name}`}>
                                            <InfoIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveExercise(loggedEx.tempId!)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Remover ${exercise.name} do treino`}>
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
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

                                        const lastSetData = lastLoggedExercise?.sets[setIndex];
                                        let lastSetString = '';
                                        if (lastSetData) {
                                            const parts = [];
                                            if (lastSetData.reps !== undefined) parts.push(`${lastSetData.reps} reps`);
                                            if (lastSetData.value !== undefined && exercise.unit === Unit.KG) parts.push(`${lastSetData.value}kg`);
                                            if (lastSetData.effort) parts.push(`PSE ${lastSetData.effort}`);
                                            if (parts.length > 0) lastSetString = `Último: ${parts.join(' x ')}`;
                                        }
                                        
                                        return (
                                            <div key={setIndex} className={`bg-light-bg dark:bg-dark-bg p-3 rounded-lg space-y-3 transition-opacity ${set.completed ? 'opacity-50' : ''}`}>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleToggleSetComplete(loggedEx.tempId!, setIndex)}>
                                                         <input type="checkbox" aria-label={`Marcar série ${setIndex + 1} como completa`} checked={!!set.completed} readOnly className="h-5 w-5 rounded text-secondary bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border focus:ring-secondary focus:ring-2 cursor-pointer" />
                                                         <span className={`font-bold text-lg text-light-text dark:text-dark-text ${set.completed ? 'line-through' : ''}`}>Série {setIndex + 1}</span>
                                                    </div>
                                                    <button onClick={() => handleDeleteSet(loggedEx.tempId!, setIndex)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Deletar série ${setIndex + 1}`}>
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                                {lastSetString && (<div className="w-full text-center text-xs text-secondary dark:text-pink-400" aria-label={`Dados da última vez: ${lastSetString}`}>{lastSetString}</div>)}
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
                                                        <div className="grow-[3] shrink basis-[100px]">
                                                            <label className="block text-xs font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">Esforço</label>
                                                            <div className="h-10">
                                                                <EffortPicker value={set.effort} onChange={(val) => handleSetChange(loggedEx.tempId!, setIndex, 'effort', val === undefined ? '' : val)} options={scaleOptions} placeholder={effortFromPlan ? `Sug: ${effortFromPlan}` : 'Selecionar...'} disabled={!!set.completed} />
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
                            {dropIndicator && dropIndicator.targetId === loggedEx.tempId && dropIndicator.position === 'bottom' && (
                                <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                            )}
                        </React.Fragment>
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
            {isTimerEditModalOpen && (<TimerEditModal isOpen={isTimerEditModalOpen} onClose={() => setIsTimerEditModalOpen(false)} onSave={handleEditTimer} initialTime={elapsedTime} />)}
            {infoExercise && (<ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />)}
        </div>
    );
};

interface TimerEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newTimeInSeconds: number) => void;
    initialTime: number;
}
const TimerEditModal: React.FC<TimerEditModalProps> = ({ isOpen, onClose, onSave, initialTime }) => {
    const [newTime, setNewTime] = useState<number | undefined>(initialTime);

    if (!isOpen) return null;

    const handleSave = () => {
        if (newTime !== undefined) {
            onSave(newTime);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Editar Cronômetro</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="timer-edit-input" className="block text-sm font-medium mb-1">Novo tempo (MM:SS)</label>
                        <TimeInput
                            id="timer-edit-input"
                            valueInSeconds={newTime}
                            onChangeInSeconds={setNewTime}
                            placeholder="00:00"
                            className="w-full text-center text-2xl font-bold bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                        />
                    </div>
                    <div className="pt-2 flex justify-end items-center space-x-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="button" onClick={handleSave} className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
interface ExercisePickerModalProps {
    onClose: () => void;
    onSelect: (exerciseId: string) => void;
    allExercises: Exercise[];
}
const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ onClose, onSelect, allExercises }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | null>(null);

    const filteredExercises = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return allExercises.filter(ex => {
            const searchMatch = !query || ex.name.toLowerCase().includes(query);
            const categoryMatch = !categoryFilter || ex.category === categoryFilter;
            return searchMatch && categoryMatch;
        });
    }, [allExercises, searchQuery, categoryFilter]);

    const exercisesByCategory = useMemo(() => {
        return filteredExercises.reduce((acc, exercise) => {
            if (!acc[exercise.category]) acc[exercise.category] = [];
            acc[exercise.category].push(exercise);
            return acc;
        }, {} as Record<ExerciseCategory, Exercise[]>);
    }, [filteredExercises]);
    
    const categoryFilterOptions: { label: string; value: ExerciseCategory | null }[] = [
        { label: 'Todos', value: null },
        { label: ExerciseCategory.RESISTED, value: ExerciseCategory.RESISTED },
        { label: ExerciseCategory.CARDIO, value: ExerciseCategory.CARDIO },
        { label: ExerciseCategory.FLEXIBILITY, value: ExerciseCategory.FLEXIBILITY }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">Selecionar Exercício</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <div className="flex-shrink-0 space-y-4 mb-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-2 pl-10 pr-4"
                            autoFocus
                        />
                    </div>
                    <div>
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-light-bg dark:bg-dark-bg p-1">
                            {categoryFilterOptions.map(option => (
                                <button
                                    key={option.label}
                                    type="button"
                                    onClick={() => setCategoryFilter(option.value)}
                                    className={`w-full whitespace-nowrap flex items-center justify-center p-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                                        categoryFilter === option.value
                                            ? 'bg-primary text-white shadow'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-border'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="overflow-y-auto space-y-3 flex-grow pr-1">
                    {Object.keys(exercisesByCategory).length > 0 ? (
                        Object.entries(exercisesByCategory).map(([category, exercises]) => (
                            <div key={category}>
                                <h4 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-2 sticky top-0 bg-light-card dark:bg-dark-card py-1">{category}</h4>
                                {exercises.map(ex => (
                                    <button
                                        key={ex.id}
                                        onClick={() => onSelect(ex.id)}
                                        className="w-full text-left p-2 rounded-md flex items-center gap-3 hover:bg-light-bg dark:hover:bg-dark-bg"
                                    >
                                        <div className="w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center">
                                            {ex.imageUrl ? (
                                                <img src={ex.imageUrl} alt={ex.name} className="w-full h-full object-cover rounded-md" loading="lazy" />
                                            ) : (
                                                <DumbbellIcon className="h-6 w-6 text-light-text-secondary" />
                                            )}
                                        </div>
                                        <span className="flex-grow">{ex.name}</span>
                                    </button>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-light-text-secondary dark:text-dark-text-secondary">
                            Nenhum exercício encontrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default WorkoutSessionScreen;