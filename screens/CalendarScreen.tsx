
import React, { useState, useMemo, useCallback, Fragment, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { WorkoutSession, Routine, Folder, PlannedExercise, Unit, Exercise, WorkoutSet, MeasurementType, ExerciseCategory } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, TrashIcon, XIcon, PlusIcon, PencilIcon, SearchIcon, MinusIcon } from '../components/Icons';
import { getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, formatDuration, vibrate } from '../utils';

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

interface GhostWorkoutItemProps {
    routine: Routine | { name: string, color: string } | undefined;
    x: number;
    y: number;
}

const GhostWorkoutItem: React.FC<GhostWorkoutItemProps> = ({ routine, x, y }) => {
    if (!routine) return null;
    const textColorClass = getContrastYIQ(routine.color);

    return (
        <div
            id="ghost-workout-item"
            className={`fixed p-1 rounded text-sm z-[9999] pointer-events-none opacity-80 shadow-2xl ${textColorClass}`}
            style={{
                backgroundColor: routine.color,
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                minWidth: '100px',
                textAlign: 'center',
            }}
        >
            <span className="font-bold w-full break-words">{routine.name}</span>
        </div>
    );
};


const CalendarScreen: React.FC = () => {
    const { routines, workouts, folders, logWorkout, updateWorkout, deleteWorkout, setActiveWorkoutSession, exercises } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
    const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<string | null>(null);
    
    const [draggingWorkoutId, setDraggingWorkoutId] = useState<string | null>(null);
    const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

    // For touch drag & drop
    const [ghostElement, setGhostElement] = useState<GhostWorkoutItemProps | null>(null);
    const dragStartInfo = useRef<{ x: number; y: number; workout: WorkoutSession; routine: Routine | { name: string, color: string } | undefined; } | null>(null);
    const dragTimeoutRef = useRef<number | null>(null);

    // Zoom state
    const ZOOM_LEVELS = [
      { containerW: 'min-w-[42rem]', cellH: 'min-h-[7.5rem]' }, // Small
      { containerW: 'min-w-[56rem]', cellH: 'min-h-[10rem]' },  // Default
      { containerW: 'min-w-[70rem]', cellH: 'min-h-[12.5rem]' },// Large
      { containerW: 'min-w-[84rem]', cellH: 'min-h-[15rem]' }, // X-Large
    ];
    const [zoomIndex, setZoomIndex] = useState(0);

    const handleZoomIn = () => {
        setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
    };

    const handleZoomOut = () => {
        setZoomIndex(prev => Math.max(prev - 1, 0));
    };

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
    
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(selectedDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${dayOfMonth}`;
    
        let workoutStartTime: string;
    
        if (time) {
            const [hours, minutes] = time.split(':');
            workoutStartTime = `${dateString}T${hours}:${minutes}:00`;
        } else {
            // Set to midnight of the local day to avoid timezone ambiguity
            workoutStartTime = `${dateString}T00:00:00`;
        }
    
        const originalPlan = JSON.parse(JSON.stringify(routine.plannedExercises || []));
    
        const newSession: Omit<WorkoutSession, 'id'> = {
            routineId: routineId,
            date: dateString,
            startTime: workoutStartTime,
            endTime: null,
            originalPlan: originalPlan,
            loggedExercises: originalPlan.map((plannedEx: PlannedExercise, index: number) => ({
                ...plannedEx,
                sets: plannedEx.sets.map((set: WorkoutSet) => ({
                    repsMin: set.repsMin,
                    repsMax: set.repsMax,
                    reps: undefined,
                    time: undefined,
                    value: undefined,
                    effort: undefined,
                    completed: false,
                })),
                tempId: `le-${Date.now()}-${index}`
            })),
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
    
    const moveWorkoutToDate = useCallback((workoutId: string, newDateString: string) => {
        const workoutToMove = workouts.find((w: WorkoutSession) => w.id === workoutId);
    
        if (workoutToMove) {
            let newStartTime: string;
            // If the original start time had a time component, preserve it
            if (workoutToMove.startTime.includes('T')) {
                const timePart = workoutToMove.startTime.split('T')[1];
                newStartTime = `${newDateString}T${timePart || '00:00:00'}`;
            } else {
                // Otherwise, the start time was likely just a date. Fix it to be an unambiguous local time string.
                newStartTime = `${newDateString}T00:00:00`;
            }
    
            const updatedWorkout: WorkoutSession = {
                ...workoutToMove,
                date: newDateString,
                startTime: newStartTime,
            };
            updateWorkout(updatedWorkout);
        }
    }, [workouts, updateWorkout]);


    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const workoutId = e.dataTransfer.getData('text/plain');
        const target = e.target as HTMLElement;
        const dayCell = target.closest('[data-date]');
        
        if (workoutId && dayCell) {
            const dayString = dayCell.getAttribute('data-date');
            if (dayString) {
                moveWorkoutToDate(workoutId, dayString);
            }
        }
        
        setDropTargetDate(null);
        setDraggingWorkoutId(null);
    }, [moveWorkoutToDate]);


    // --- Touch Handlers for Mobile Drag & Drop ---
    const handleTouchStart = (e: React.TouchEvent, workout: WorkoutSession, routine: Routine | { name: string, color: string } | undefined) => {
        if (e.touches.length > 1) return;

        dragStartInfo.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            workout,
            routine,
        };

        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
        }

        dragTimeoutRef.current = window.setTimeout(() => {
            if (!dragStartInfo.current) return;

            const { workout, routine, x, y } = dragStartInfo.current;
            setDraggingWorkoutId(workout.id);
            setGhostElement({
                routine,
                x,
                y,
            });
            vibrate(50);
            dragTimeoutRef.current = null;
        }, 500); // 500ms delay for long press
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if (!dragStartInfo.current) return;
        
        const touch = e.touches[0];
        
        // If we are not yet dragging (long press timer is still running)
        if (!draggingWorkoutId) {
            const dx = Math.abs(touch.clientX - dragStartInfo.current.x);
            const dy = Math.abs(touch.clientY - dragStartInfo.current.y);

            // If user moves too much, it's a scroll, not a drag. Cancel the timer.
            if (dx > 10 || dy > 10) {
                if (dragTimeoutRef.current) {
                    clearTimeout(dragTimeoutRef.current);
                    dragTimeoutRef.current = null;
                }
                dragStartInfo.current = null; // Cancel the potential drag
            }
            return; // Don't do anything else until drag starts
        }
    
        // Drag has started, update ghost position
        if (e.cancelable) e.preventDefault();
    
        setGhostElement(g => g ? { ...g, x: touch.clientX, y: touch.clientY } : null);
        
        const ghostDOMElement = document.getElementById('ghost-workout-item');
        if (ghostDOMElement) ghostDOMElement.style.display = 'none';
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (ghostDOMElement) ghostDOMElement.style.display = 'block';
    
        const dayCell = targetElement?.closest('[data-date]');
        const date = dayCell?.getAttribute('data-date');
        setDropTargetDate(date || null);
    };

    const handleTouchEnd = () => {
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }
    
        if (draggingWorkoutId && dropTargetDate) {
            // dropTargetDate is already a 'YYYY-MM-DD' string from the data-date attribute.
            moveWorkoutToDate(draggingWorkoutId, dropTargetDate);
        }
        
        // Cleanup
        setDraggingWorkoutId(null);
        setDropTargetDate(null);
        setGhostElement(null);
        dragStartInfo.current = null;
    };

    const today = new Date();
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div 
            className="relative px-2 xl:px-4 py-4 flex flex-col h-full text-light-text dark:text-dark-text"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            <header className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-light-card dark:hover:bg-dark-card flex items-center justify-center"><ChevronLeftIcon className="h-6 w-6" /></button>
                <h2 className="text-lg font-bold capitalize">{formatDate(currentDate)}</h2>
                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-light-card dark:hover:bg-dark-card flex items-center justify-center"><ChevronRightIcon className="h-6 w-6" /></button>
            </header>
            <div className="flex-grow overflow-x-auto">
                <div className={ZOOM_LEVELS[zoomIndex].containerW}>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                        {weekdays.map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarGrid.map((day, index) => {
                            const dayString = day ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` : '';
                            const isDropTarget = dropTargetDate === dayString;

                            return (
                                <div key={index} 
                                     data-date={dayString}
                                     className={`relative p-1 border border-light-border dark:border-dark-border rounded-md ${ZOOM_LEVELS[zoomIndex].cellH} flex flex-col transition-all duration-300 ${day ? 'hover:bg-light-card dark:hover:bg-dark-card cursor-pointer' : 'bg-transparent border-transparent'} ${isDropTarget ? 'bg-primary/20 border-primary' : ''}`}
                                     onClick={() => day && handleDayClick(day)}
                                     onDragOver={(e) => {
                                         e.preventDefault();
                                         if(day) setDropTargetDate(dayString);
                                     }}
                                     onDragLeave={() => setDropTargetDate(null)}
                                     onDrop={handleDrop}
                                >
                                    {day && (
                                        <>
                                            <span className={`text-xs ${isSameDay(day, today) ? 'bg-secondary text-white rounded-full h-5 w-5 flex items-center justify-center font-bold' : ''} ${day.getMonth() !== currentDate.getMonth() ? 'text-gray-400 dark:text-gray-600' : ''}`}>
                                                {day.getDate()}
                                            </span>
                                            <div className="mt-1 space-y-1">
                                                {workoutsByDate.get(dayString)?.map(workout => {
                                                    let routine: Routine | { name: string, color: string } | undefined = routines.find((r: Routine) => r.id === workout.routineId);
                                                    
                                                    // Handle internal performance tests
                                                    if (!routine && workout.routineId === 'internal_test') {
                                                        routine = { name: 'Teste Físico', color: '#6B7280' };
                                                    }

                                                    const textColorClass = getContrastYIQ(routine?.color);
                                                    return (
                                                        <div key={workout.id} 
                                                             onClick={(e) => { e.stopPropagation(); handleWorkoutClick(workout)}}
                                                             onTouchStart={(e) => handleTouchStart(e, workout, routine)}
                                                             draggable="true"
                                                             onDragStart={(e) => {
                                                                 e.stopPropagation();
                                                                 e.dataTransfer.setData('text/plain', workout.id);
                                                                 e.dataTransfer.effectAllowed = 'move';
                                                                 setDraggingWorkoutId(workout.id);
                                                             }}
                                                             onDragEnd={() => {
                                                                 setDraggingWorkoutId(null);
                                                                 setDropTargetDate(null);
                                                             }}
                                                             className={`text-sm p-1 rounded flex items-start cursor-grab transition-opacity ${textColorClass} ${draggingWorkoutId === workout.id ? 'opacity-50' : workout.completed ? 'opacity-60' : ''}`}
                                                             style={{ backgroundColor: routine?.color, touchAction: 'none' }}>
                                                             <span className="font-bold w-full break-words leading-tight">{routine?.name}</span>
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
                </div>
            </div>
             {ghostElement && <GhostWorkoutItem {...ghostElement} />}
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
                    routine={routines.find((r:Routine) => r.id === selectedWorkout.routineId) || (selectedWorkout.routineId === 'internal_test' ? { id: 'internal_test', name: 'Teste Físico', color: '#6B7280', plannedExercises: [], folderId: null } : undefined)}
                    exercises={exercises}
                    onClose={() => setSelectedWorkout(null)}
                    onDelete={() => setConfirmDeleteWorkoutId(selectedWorkout.id)}
                    onStart={() => {
                        if (selectedWorkout) {
                            if (!selectedWorkout.completed) {
                                // For un-completed workouts, reset the start time to now.
                                setActiveWorkoutSession({
                                    ...selectedWorkout,
                                    startTime: new Date().toISOString(),
                                });
                            } else {
                                // For completed ones, just open for editing.
                                setActiveWorkoutSession(selectedWorkout);
                            }
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
            <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-40">
                <button 
                    onClick={handleZoomIn} 
                    className="bg-primary hover:bg-primary-dark text-white rounded-full p-3 shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                    aria-label="Aumentar visualização"
                    disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                >
                    <PlusIcon className="h-6 w-6" />
                </button>
                <button 
                    onClick={handleZoomOut} 
                    className="bg-primary hover:bg-primary-dark text-white rounded-full p-3 shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                    aria-label="Diminuir visualização"
                    disabled={zoomIndex === 0}
                >
                    <MinusIcon className="h-6 w-6" />
                </button>
            </div>
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
    const [searchQuery, setSearchQuery] = useState('');
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [pickerRef]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (routineId) onSave(routineId, time);
    };
    
    const { filteredFoldersWithRoutines, filteredRoutinesWithoutFolder } = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const folderMap = new Map<string, Routine[]>();
        folders.forEach(f => folderMap.set(f.id, []));
        const routinesWithoutFolder: Routine[] = [];

        for (const routine of routines) {
            if (!query || routine.name.toLowerCase().includes(query)) {
                if (routine.folderId && folderMap.has(routine.folderId)) {
                    folderMap.get(routine.folderId)!.push(routine);
                } else {
                    routinesWithoutFolder.push(routine);
                }
            }
        }
        return { 
            filteredFoldersWithRoutines: folderMap,
            filteredRoutinesWithoutFolder: routinesWithoutFolder
        };
    }, [searchQuery, routines, folders]);

    const selectedRoutine = routines.find(r => r.id === routineId);

    const noResults = filteredRoutinesWithoutFolder.length === 0 && [...filteredFoldersWithRoutines.values()].every(r => r.length === 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-11/12 max-w-sm text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Agendar Treino</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <p className="mb-4">Data: <span className="font-semibold">{date.toLocaleDateString('pt-BR')}</span></p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4 relative" ref={pickerRef}>
                        <label className="block text-sm font-medium mb-1">Rotina</label>
                        <button
                            type="button"
                            onClick={() => setIsPickerOpen(!isPickerOpen)}
                            className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-light-text dark:text-dark-text"
                        >
                            {selectedRoutine ? (
                                <div className="flex items-center">
                                    <span className="h-4 w-4 rounded-sm mr-2 flex-shrink-0" style={{ backgroundColor: selectedRoutine.color }}></span>
                                    <span>{selectedRoutine.name}</span>
                                </div>
                            ) : (
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Selecione uma rotina...</span>
                            )}
                            <ChevronRightIcon className={`h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary transition-transform ${isPickerOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {isPickerOpen && (
                            <div className="absolute top-full mt-1 w-full max-h-60 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-xl z-20 p-2">
                                <div className="relative mb-2">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar rotina..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md py-2 pl-10 pr-4"
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {folders.map(folder => {
                                        const folderRoutines = filteredFoldersWithRoutines.get(folder.id);
                                        if (!folderRoutines || folderRoutines.length === 0) return null;

                                        return (
                                            <div key={folder.id}>
                                                <h5 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary px-2 py-1">{folder.name}</h5>
                                                {folderRoutines.map(r => (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => { setRoutineId(r.id); setIsPickerOpen(false); }}
                                                        className="w-full text-left p-2 rounded-md flex items-center hover:bg-light-bg dark:hover:bg-dark-bg"
                                                    >
                                                        <span className="h-4 w-4 rounded-sm mr-3 flex-shrink-0" style={{ backgroundColor: r.color }}></span>
                                                        <span className="truncate">{r.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })}

                                    {filteredRoutinesWithoutFolder.length > 0 && (
                                        <div>
                                            {[...filteredFoldersWithRoutines.values()].some(r => r.length > 0) && (
                                                <h5 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary px-2 py-1 mt-2 border-t border-light-border dark:border-dark-border pt-1">Sem pasta</h5>
                                            )}
                                            {filteredRoutinesWithoutFolder.map(r => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => { setRoutineId(r.id); setIsPickerOpen(false); }}
                                                    className="w-full text-left p-2 rounded-md flex items-center hover:bg-light-bg dark:hover:bg-dark-bg"
                                                >
                                                    <span className="h-4 w-4 rounded-sm mr-3 flex-shrink-0" style={{ backgroundColor: r.color }}></span>
                                                    <span className="truncate">{r.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {noResults && (
                                        <div className="text-center p-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            Nenhuma rotina encontrada.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="time" className="block text-sm font-medium mb-1">Horário (Opcional)</label>
                        <input type="time" id="time" value={time} onChange={e => setTime(e.target.value)}
                               className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-light-text dark:text-dark-text focus:ring-secondary focus:border-secondary" />
                    </div>
                    <button type="submit" disabled={!routineId} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
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
    routine?: Routine | { id: string, name: string, color: string, plannedExercises: any[], folderId: string | null };
    exercises: Exercise[];
    onClose: () => void;
    onStart: () => void;
    onDelete: () => void;
}

const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, routine, exercises, onClose, onStart, onDelete }) => {
    if(!routine) return null;
    
    const isCompleted = workout.completed;
    const durationString = formatDuration(workout.duration);

    // For planned workouts, use the original plan. For completed, use the logged exercises.
    const exercisesToDisplay = isCompleted ? workout.loggedExercises : (workout.originalPlan || []);

    return (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-11/12 max-w-sm text-light-text dark:text-dark-text max-h-[90vh] flex flex-col shadow-2xl">
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
                    {'notes' in routine && routine.notes && (
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
                    {(exercisesToDisplay).map((plannedEx, idx) => {
                        const exercise = exercises.find(e => e.id === plannedEx.exerciseId);
                        if (!exercise) return <div key={idx} className="text-sm text-red-500">Exercício não encontrado</div>;

                        const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);

                        return (
                            <div key={`${exercise.id}-${idx}`} className="text-sm">
                                <div className="flex flex-col">
                                    <p className="font-semibold text-light-text dark:text-dark-text">{exercise.name}</p>
                                    
                                    {/* Modifiers Badges for Resisted Exercises */}
                                    {exercise.category === ExerciseCategory.RESISTED && (
                                        <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                            {exercise.isWeightDoubled && (
                                                <span className="text-[10px] bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Peso 2x</span>
                                            )}
                                            {exercise.isCounterweight && (
                                                <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Contrapeso</span>
                                            )}
                                            {plannedEx.barbellWeight ? (
                                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Barra: +{plannedEx.barbellWeight}kg</span>
                                            ) : exercise.includeBarbellWeight && (
                                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Barra incluída</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {plannedEx.notes && (
                                    <p className="text-xs pl-2 mt-1 text-light-text-secondary dark:text-dark-text-secondary italic">
                                        Anotação: {plannedEx.notes}
                                    </p>
                                )}
                                <div className="pl-2 mt-1 space-y-1 text-light-text-secondary dark:text-dark-text-secondary border-l border-light-border dark:border-dark-border ml-1">
                                    {plannedEx.sets.map((set, index) => {
                                        const effortLabel = scaleOptions?.find(opt => opt.value === set.effort)?.label;
                                        
                                        const setInfoParts = [];

                                        // Part 1: Reps or Time
                                        if (isCompleted) {
                                            if (set.reps !== undefined) {
                                                setInfoParts.push(`${set.reps} reps`);
                                            } else if (set.time !== undefined) {
                                                setInfoParts.push(formatSecondsToMMSS(set.time));
                                            }
                                        } else { // Planned
                                            if (exercise.measurementType === MeasurementType.COUNT) {
                                                if (set.repsMin !== undefined || set.repsMax !== undefined) {
                                                    if (set.repsMin !== undefined && set.repsMax !== undefined && set.repsMin !== set.repsMax) {
                                                        setInfoParts.push(`${set.repsMin}-${set.repsMax} reps`);
                                                    } else {
                                                        setInfoParts.push(`${set.repsMin ?? set.repsMax} reps`);
                                                    }
                                                } else if (set.reps !== undefined) {
                                                    setInfoParts.push(`${set.reps} reps`);
                                                }
                                            } else { // MeasurementType.TIME
                                                if (set.time !== undefined) {
                                                    setInfoParts.push(formatSecondsToMMSS(set.time));
                                                }
                                            }
                                        }

                                        // Part 2: Value and Unit
                                        if (set.value != null && exercise.unit !== Unit.NONE) {
                                            setInfoParts.push(`${set.value} ${exercise.unit}`);
                                        }

                                        const setInfo = setInfoParts.join(' com ');
                                        
                                        return (
                                            <div key={index}>
                                                <p className={set.completed ? 'line-through opacity-60' : ''}>
                                                    S{index + 1}: {setInfo || (isCompleted ? "Não registrado" : "Não planejado")}
                                                </p>
                                                {effortLabel && (
                                                     <p className="text-[10px] pl-4 italic text-pink-500 dark:text-pink-400">
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
