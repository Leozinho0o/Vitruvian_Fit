
import React, { useState, useMemo, useCallback, Fragment } from 'react';
import { useApp } from '../App';
import { WorkoutSession, Routine, Folder, PlannedExercise, Unit, Exercise, WorkoutSet } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, TrashIcon, XIcon, PlusIcon, PencilIcon } from '../components/Icons';
import { getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, formatDuration } from '../utils';

// Helper function to determine text color based on background hex color
const getContrastYIQ = (hexcolor?: string): string => {
    if (!hexcolor) return 'text-white';
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substring(0, 2), 16);
    const g = parseInt(hexcolor.substring(2, 4), 16);
    const b = parseInt(hexcolor.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'text-black' : 'text-white';
};

const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const formatDate = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const CalendarScreen: React.FC = () => {
    const { routines, workouts, folders, logWorkout, updateWorkout, deleteWorkout, setActiveWorkoutSession, exercises } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
    const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<string | null>(null);
    
    const [draggingWorkoutId, setDraggingWorkoutId] = useState<string | null>(null);
    const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);


    const handlePrevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

        return days;
    }, [currentDate]);

    const workoutsByDate = useMemo(() => {
        const map = new Map<string, WorkoutSession[]>();
        workouts.forEach((workout: WorkoutSession) => {
            const dateKey = workout.date;
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)?.push(workout);
        });
        return map;
    }, [workouts]);

    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
    };
    
    const handleWorkoutClick = (workout: WorkoutSession) => {
        setSelectedWorkout(workout);
    }
    
    const handleSaveWorkout = (routineId: string, time: string) => {
        if (!selectedDate || !routineId) return;

        const routine = routines.find((r: Routine) => r.id === routineId);
        if (!routine) return;

        const dateString = selectedDate.toISOString().split('T')[0];
        let workoutStartTime: string;

        if (time) {
            const [hours, minutes] = time.split(':').map(Number);
            const workoutDate = new Date(selectedDate);
            workoutDate.setHours(hours, minutes, 0, 0);
            workoutStartTime = workoutDate.toISOString();
        } else {
            // Convention: If no time is provided, store only the date string.
            // This lets us know that a specific time was not set.
            workoutStartTime = dateString;
        }

        const newSession: Omit<WorkoutSession, 'id'> = {
            routineId: routineId,
            date: dateString,
            startTime: workoutStartTime,
            endTime: null,
            loggedExercises: JSON.parse(JSON.stringify(routine.plannedExercises || [])),
            completed: false,
        };
        logWorkout(newSession);
        setSelectedDate(null);
    };

    const handleConfirmDeleteWorkout = () => {
        if (confirmDeleteWorkoutId) {
            deleteWorkout(confirmDeleteWorkoutId);
            setSelectedWorkout(null);
            setConfirmDeleteWorkoutId(null);
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
        e.preventDefault();
        const workoutId = e.dataTransfer.getData('application/vitruvian-fit-workout');
        const workoutToMove = workouts.find((w: WorkoutSession) => w.id === workoutId);

        if (workoutToMove) {
            const newDate = new Date(day);
            
            let newStartTime: string;
            // If original startTime has time component, preserve it
            if (workoutToMove.startTime.includes('T')) {
                const originalTime = new Date(workoutToMove.startTime);
                newDate.setHours(originalTime.getHours());
                newDate.setMinutes(originalTime.getMinutes());
                newDate.setSeconds(originalTime.getSeconds());
                newDate.setMilliseconds(originalTime.getMilliseconds());
                newStartTime = newDate.toISOString();
            } else {
                newStartTime = newDate.toISOString().split('T')[0];
            }

            const updatedWorkout: WorkoutSession = {
                ...workoutToMove,
                date: newDate.toISOString().split('T')[0],
                startTime: newStartTime
            };
            updateWorkout(updatedWorkout);
        }
        setDropTargetDate(null);
        setDraggingWorkoutId(null);
    };


    const today = new Date();
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="px-2 lg:px-4 py-4 flex flex-col h-full text-light-text dark:text-dark-text">
            <header className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-light-card dark:hover:bg-dark-card flex items-center justify-center"><ChevronLeftIcon className="h-6 w-6" /></button>
                <h2 className="text-lg font-bold capitalize">{formatDate(currentDate)}</h2>
                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-light-card dark:hover:bg-dark-card flex items-center justify-center"><ChevronRightIcon className="h-6 w-6" /></button>
            </header>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {weekdays.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-grow">
                {calendarGrid.map((day, index) => {
                    const dayString = day ? day.toISOString().split('T')[0] : '';
                    const isDropTarget = dropTargetDate === dayString;

                    return (
                        <div key={index} 
                             className={`relative p-1 border border-light-border dark:border-dark-border rounded-md min-h-[8rem] lg:min-h-[10rem] flex flex-col transition-colors duration-200 ${day ? 'hover:bg-light-card dark:hover:bg-dark-card cursor-pointer' : 'bg-transparent border-transparent'} ${isDropTarget ? 'bg-primary/20 border-primary' : ''}`}
                             onClick={() => day && handleDayClick(day)}
                             onDragOver={(e) => {
                                 e.preventDefault();
                                 if(day) setDropTargetDate(dayString);
                             }}
                             onDragLeave={() => setDropTargetDate(null)}
                             onDrop={(e) => day && handleDrop(e, day)}
                        >
                            {day && (
                                <>
                                    <span className={`text-xs ${isSameDay(day, today) ? 'bg-secondary text-white rounded-full h-5 w-5 flex items-center justify-center font-bold' : ''} ${day.getMonth() !== currentDate.getMonth() ? 'text-gray-400 dark:text-gray-600' : ''}`}>
                                        {day.getDate()}
                                    </span>
                                    <div className="mt-1 space-y-1">
                                        {workoutsByDate.get(dayString)?.map(workout => {
                                            const routine = routines.find((r: Routine) => r.id === workout.routineId);
                                            const textColorClass = getContrastYIQ(routine?.color);
                                            return (
                                                <div key={workout.id} 
                                                     onClick={(e) => { e.stopPropagation(); handleWorkoutClick(workout)}}
                                                     draggable="true"
                                                     onDragStart={(e) => {
                                                         e.stopPropagation();
                                                         e.dataTransfer.setData('application/vitruvian-fit-workout', workout.id);
                                                         e.dataTransfer.effectAllowed = 'move';
                                                         setDraggingWorkoutId(workout.id);
                                                     }}
                                                     onDragEnd={() => {
                                                         setDraggingWorkoutId(null);
                                                         setDropTargetDate(null);
                                                     }}
                                                     className={`text-sm p-1 rounded flex items-start cursor-grab transition-opacity ${textColorClass} ${draggingWorkoutId === workout.id ? 'opacity-50' : workout.completed ? 'opacity-60' : ''}`}
                                                     style={{ backgroundColor: routine?.color }}>
                                                     <span className="font-bold w-full break-words">{routine?.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
             {selectedDate && (
                <AddWorkoutModal 
                    onClose={() => setSelectedDate(null)} 
                    onSave={handleSaveWorkout}
                    date={selectedDate}
                    routines={routines}
                    folders={folders}
                />
            )}
            {selectedWorkout && (
                <WorkoutDetailModal
                    workout={selectedWorkout}
                    routine={routines.find((r:Routine) => r.id === selectedWorkout.routineId)}
                    exercises={exercises}
                    onClose={() => setSelectedWorkout(null)}
                    onDelete={() => setConfirmDeleteWorkoutId(selectedWorkout.id)}
                    onStart={() => {
                        if (selectedWorkout) {
                           setActiveWorkoutSession(selectedWorkout);
                        }
                        setSelectedWorkout(null);
                    }}
                />
            )}
            {confirmDeleteWorkoutId && (
                <ConfirmationModal
                    isOpen={!!confirmDeleteWorkoutId}
                    onClose={() => setConfirmDeleteWorkoutId(null)}
                    onConfirm={handleConfirmDeleteWorkout}
                    title="Confirmar Exclusão"
                    message="Tem certeza que deseja apagar este agendamento/registro de treino? Esta ação não pode ser desfeita."
                />
            )}
        </div>
    );
};


interface AddWorkoutModalProps {
    onClose: () => void;
    onSave: (routineId: string, time: string) => void;
    date: Date;
    routines: Routine[];
    folders: Folder[];
}

const AddWorkoutModal: React.FC<AddWorkoutModalProps> = ({ onClose, onSave, date, routines, folders }) => {
    const [routineId, setRoutineId] = useState<string>('');
    const [time, setTime] = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (routineId) onSave(routineId, time);
    };
    
    const foldersWithRoutines = useMemo(() => {
        const folderMap = new Map<string, Routine[]>();
        folders.forEach(f => folderMap.set(f.id, []));
        routines.forEach(r => {
           if(r.folderId && folderMap.has(r.folderId)) {
               folderMap.get(r.folderId)?.push(r);
           }
        });
        return folderMap;
    }, [folders, routines]);
    
    const routinesWithoutFolder = routines.filter(r => !r.folderId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-11/12 max-w-sm text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Agendar Treino</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <p className="mb-4">Data: <span className="font-semibold">{date.toLocaleDateString('pt-BR')}</span></p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="routine" className="block text-sm font-medium mb-1">Rotina</label>
                        <select id="routine" value={routineId} onChange={e => setRoutineId(e.target.value)} required
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-light-text dark:text-dark-text focus:ring-secondary focus:border-secondary">
                            <option value="" disabled>Selecione uma rotina...</option>
                            {Array.from(foldersWithRoutines.entries()).map(([folderId, folderRoutines]) => (
                                <optgroup key={folderId} label={folders.find(f => f.id === folderId)?.name}>
                                    {folderRoutines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </optgroup>
                            ))}
                            {routinesWithoutFolder.length > 0 && <optgroup label="Outras">
                                {routinesWithoutFolder.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </optgroup>}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label htmlFor="time" className="block text-sm font-medium mb-1">Horário (Opcional)</label>
                        <input type="time" id="time" value={time} onChange={e => setTime(e.target.value)}
                               className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-light-text dark:text-dark-text focus:ring-secondary focus:border-secondary" />
                    </div>
                    <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center">
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Agendar
                    </button>
                </form>
            </div>
        </div>
    );
};


interface WorkoutDetailModalProps {
    workout: WorkoutSession;
    routine?: Routine;
    exercises: Exercise[];
    onClose: () => void;
    onStart: () => void;
    onDelete: () => void;
}

const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, routine, exercises, onClose, onStart, onDelete }) => {
    if(!routine) return null;
    
    const isCompleted = workout.completed;
    const durationString = formatDuration(workout.duration);

    return (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-11/12 max-w-sm text-light-text dark:text-dark-text max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold flex items-center">
                        <span className="h-4 w-4 rounded-full mr-3" style={{backgroundColor: routine.color}}></span>
                        {routine.name}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <div className="flex-shrink-0">
                    <div className="flex justify-between items-baseline mb-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                       {workout.startTime.includes('T') && (
                            <p>Horário: <span className="font-semibold text-light-text dark:text-dark-text">{new Date(workout.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></p>
                        )}
                        {durationString && (
                            <p>Duração: <span className="font-semibold text-light-text dark:text-dark-text">{durationString}</span></p>
                        )}
                    </div>
                    {routine.notes && (
                        <div className="mb-4 bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                            <p className="text-sm font-semibold mb-1 text-light-text dark:text-dark-text">Anotações da Rotina:</p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">"{routine.notes}"</p>
                        </div>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto my-2 pr-2 space-y-3">
                    <h4 className="font-semibold text-light-text dark:text-dark-text">
                        {isCompleted ? "Exercícios Realizados:" : "Exercícios Planejados:"}
                    </h4>
                    {(workout.loggedExercises || []).map((plannedEx, idx) => {
                        const exercise = exercises.find(e => e.id === plannedEx.exerciseId);
                        if (!exercise) return <div key={idx} className="text-sm text-red-500">Exercício não encontrado</div>;

                        const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);

                        return (
                            <div key={`${exercise.id}-${idx}`} className="text-sm">
                                <p className="font-semibold text-light-text dark:text-dark-text">{exercise.name}</p>
                                {plannedEx.notes && (
                                    <p className="text-xs pl-2 mt-1 text-light-text-secondary dark:text-dark-text-secondary italic">
                                        Anotação: {plannedEx.notes}
                                    </p>
                                )}
                                <div className="pl-2 mt-1 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                                    {plannedEx.sets.map((set, index) => {
                                        const effortLabel = scaleOptions?.find(opt => opt.value === set.effort)?.label;
                                        
                                        let setInfo = '';
                                        if (isCompleted) {
                                            // For completed workouts, prioritize actual logged data.
                                            if (set.reps !== undefined) {
                                                setInfo = `${set.reps} reps`;
                                            } else if (set.time !== undefined) {
                                                setInfo = formatSecondsToMMSS(set.time);
                                            }
                                        } else {
                                            // For planned workouts, show the plan.
                                            if (set.repsMin !== undefined || set.repsMax !== undefined) {
                                                if (set.repsMin !== undefined && set.repsMax !== undefined) {
                                                    setInfo = `${set.repsMin} a ${set.repsMax} reps`;
                                                } else {
                                                    setInfo = `${set.repsMin ?? set.repsMax} reps`;
                                                }
                                            } else if (set.reps !== undefined) {
                                                setInfo = `${set.reps} reps`;
                                            } else if (set.time !== undefined) {
                                                setInfo = formatSecondsToMMSS(set.time);
                                            }
                                        }

                                        return (
                                            <div key={index}>
                                                <p className={set.completed ? 'line-through opacity-60' : ''}>
                                                    Série {index + 1}: {setInfo}
                                                    {set.value != null && ` com ${set.value} ${exercise.unit !== Unit.NONE ? exercise.unit : ''}`}
                                                </p>
                                                {effortLabel && (
                                                     <p className="text-xs pl-4 italic text-pink-500 dark:text-pink-400">
                                                        Esforço: {effortLabel}
                                                     </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                <div className="space-y-4 mt-4 flex-shrink-0">
                    {isCompleted ? (
                         <button onClick={onStart} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-md flex items-center justify-center text-lg">
                            <PencilIcon className="h-6 w-6 mr-2" />
                            Editar Treino
                        </button>
                    ) : (
                        <button onClick={onStart} className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center text-lg">
                            <PlayIcon className="h-6 w-6 mr-2" />
                            Iniciar Treino
                        </button>
                    )}
                     <button onClick={onDelete} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center">
                        <TrashIcon className="h-5 w-5 mr-2" />
                        {isCompleted ? "Apagar Registro" : "Apagar Agendamento"}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CalendarScreen;
