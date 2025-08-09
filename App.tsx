

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Exercise, Routine, Folder, WorkoutSession, Theme, UserMeasurements, Evaluation } from './types';
import { INITIAL_EXERCISES, INITIAL_ROUTINES, INITIAL_FOLDERS, DEFAULT_MUSCLE_GROUPS } from './constants';
import RoutinesScreen from './screens/RoutinesScreen';
import CalendarScreen from './screens/CalendarScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import WorkoutSessionScreen from './screens/WorkoutSessionScreen';
import SettingsScreen from './screens/SettingsScreen';
import StatsScreen from './screens/StatsScreen';
import Sidebar from './components/Sidebar';
import ExerciseFormScreen from './screens/ExerciseFormScreen';
import MeasurementsScreen from './screens/MeasurementsScreen';
import MuscleGroupsScreen from './screens/MuscleGroupsScreen';
import PhysicalEvaluationScreen from './screens/PhysicalEvaluationScreen';
import PhysicalTestsScreen from './screens/PhysicalTestsScreen';
import ConfirmationModal from './components/ConfirmationModal';


import { DumbbellIcon, RepeatIcon, CalendarIcon, BarChartIcon, SettingsIcon } from './components/Icons';

export const AppContext = React.createContext<any>(null);

export const useApp = () => React.useContext(AppContext);


// Custom hook to manage state with localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}


const App: React.FC = () => {
    const [activeView, setActiveView] = useState<View>(View.ROUTINES);
    
    // Data state using localStorage for persistence
    const [exercises, setExercises] = useLocalStorage<Exercise[]>('vitruvian_fit_exercises', INITIAL_EXERCISES);
    const [routines, setRoutines] = useLocalStorage<Routine[]>('vitruvian_fit_routines', INITIAL_ROUTINES);
    const [folders, setFolders] = useLocalStorage<Folder[]>('vitruvian_fit_folders', INITIAL_FOLDERS);
    const [workouts, setWorkouts] = useLocalStorage<WorkoutSession[]>('vitruvian_fit_workouts', []);
    const [muscleGroups, setMuscleGroups] = useLocalStorage<string[]>('vitruvian_fit_muscleGroups', DEFAULT_MUSCLE_GROUPS);
    const [evaluations, setEvaluations] = useLocalStorage<Evaluation[]>('vitruvian_fit_evaluations', []);


    // Theme state
    const [theme, setTheme] = useLocalStorage<Theme>('vitruvian_fit_theme', Theme.SYSTEM);

    // Active workout state
    const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);
    const [editingExercise, setEditingExercise] = useState<Exercise | 'new' | null>(null);
    const [isMeasurementsScreenOpen, setIsMeasurementsScreenOpen] = useState(false);
    const [isMuscleGroupsScreenOpen, setIsMuscleGroupsScreenOpen] = useState(false);
    const [isPhysicalEvaluationScreenOpen, setIsPhysicalEvaluationScreenOpen] = useState(false);
    const [isPhysicalTestsScreenOpen, setIsPhysicalTestsScreenOpen] = useState(false);
    const [selectedEvaluationDate, setSelectedEvaluationDate] = useState<string | null>(null);
    const [infoModalContent, setInfoModalContent] = useState<{ title: string; message: React.ReactNode; onConfirm?: () => void; confirmText?: string; showCancelButton?: boolean, cancelText?: string; } | null>(null);


    // Apply theme effect
    useEffect(() => {
        const root = window.document.documentElement;
        const applyTheme = () => {
            const isDark =
                theme === Theme.DARK ||
                (theme === Theme.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches);
            root.classList.toggle('dark', isDark);
        };

        applyTheme();

        if (theme === Theme.SYSTEM) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme();
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);


    const addExercise = useCallback((exercise: Omit<Exercise, 'id'>) => {
        setExercises(prev => [...prev, { ...exercise, id: `ex${Date.now()}` }]);
    }, [setExercises]);

    const updateExercise = useCallback((updatedExercise: Exercise) => {
        setExercises(prev => prev.map(e => e.id === updatedExercise.id ? updatedExercise : e));
    }, [setExercises]);
    
    const duplicateExercise = useCallback((exerciseId: string) => {
        setExercises(prevExercises => {
            const exerciseToDuplicate = prevExercises.find(e => e.id === exerciseId);
            if (!exerciseToDuplicate) {
                console.error("Exercise to duplicate not found");
                return prevExercises;
            }

            const newExercise: Exercise = {
                ...JSON.parse(JSON.stringify(exerciseToDuplicate)), // Deep copy
                id: `ex${Date.now()}`,
                name: `${exerciseToDuplicate.name} (Cópia)`,
            };

            const index = prevExercises.findIndex(e => e.id === exerciseId);
            const newExercisesList = [...prevExercises];
            if (index !== -1) {
                newExercisesList.splice(index + 1, 0, newExercise);
            } else {
                newExercisesList.push(newExercise);
            }
            return newExercisesList;
        });
    }, [setExercises]);

    const deleteExercise = useCallback((exerciseId: string) => {
        setExercises(prev => prev.filter(e => e.id !== exerciseId));
        // Remove the exercise from any routine that uses it
        setRoutines(prev => prev.map(r => ({
            ...r,
            plannedExercises: r.plannedExercises.filter(pe => pe.exerciseId !== exerciseId)
        })));
    }, [setExercises, setRoutines]);
    
    const addMuscleGroup = useCallback((group: string) => {
        setMuscleGroups(prev => {
           const newGroup = group.trim();
           if (newGroup && !prev.includes(newGroup)) {
               return [...prev, newGroup].sort();
           }
           return prev;
        });
    }, [setMuscleGroups]);

    const editMuscleGroup = useCallback((oldName: string, newName: string) => {
        const trimmedNewName = newName.trim();
        
        setMuscleGroups(prevGroups => {
            if (!trimmedNewName || (prevGroups.includes(trimmedNewName) && oldName !== trimmedNewName)) {
                alert('Nome inválido ou já existente.');
                return prevGroups;
            }
            
            setExercises(prevEx => prevEx.map(ex => ({
                ...ex,
                primaryMuscles: ex.primaryMuscles.map(m => m === oldName ? trimmedNewName : m),
                secondaryMuscles: ex.secondaryMuscles.map(m => m === oldName ? trimmedNewName : m),
            })));

            return prevGroups.map(m => m === oldName ? trimmedNewName : m).sort();
        });
    }, [setMuscleGroups, setExercises]);

    const deleteMuscleGroup = useCallback((nameToDelete: string) => {
        setMuscleGroups(prev => prev.filter(m => m !== nameToDelete));
        setExercises(prev => prev.map(ex => ({
            ...ex,
            primaryMuscles: ex.primaryMuscles.filter(m => m !== nameToDelete),
            secondaryMuscles: ex.secondaryMuscles.filter(m => m !== nameToDelete),
        })));
    }, [setMuscleGroups, setExercises]);


    const addRoutine = useCallback((routine: Omit<Routine, 'id'>) => {
        setRoutines(prev => [...prev, { ...routine, id: `r${Date.now()}` }]);
    }, [setRoutines]);

    const updateRoutine = useCallback((updatedRoutine: Routine) => {
        setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutine : r));
    }, [setRoutines]);

    const deleteRoutine = useCallback((routineId: string) => {
        setRoutines(prev => prev.filter(r => r.id !== routineId));
        setWorkouts(prev => prev.filter(w => w.routineId !== routineId));
    }, [setRoutines, setWorkouts]);

    const duplicateRoutine = useCallback((routineId: string) => {
        setRoutines(prevRoutines => {
            const routineToDuplicate = prevRoutines.find(r => r.id === routineId);
            if (!routineToDuplicate) {
                console.error("Routine to duplicate not found");
                return prevRoutines;
            }

            const newRoutine: Routine = {
                ...JSON.parse(JSON.stringify(routineToDuplicate)), // Deep copy
                id: `r${Date.now()}`,
                name: `${routineToDuplicate.name} (Cópia)`,
            };

            const index = prevRoutines.findIndex(r => r.id === routineId);
            const newRoutinesList = [...prevRoutines];
            if (index !== -1) {
                newRoutinesList.splice(index + 1, 0, newRoutine);
            } else {
                newRoutinesList.push(newRoutine);
            }
            return newRoutinesList;
        });
    }, [setRoutines]);
    
    const moveRoutineToFolder = useCallback((routineId: string, folderId: string | null) => {
        setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, folderId } : r));
    }, [setRoutines]);

    const reorderRoutines = useCallback((draggedRoutineId: string, targetRoutineId: string) => {
        setRoutines(prevRoutines => {
            const draggedIndex = prevRoutines.findIndex(r => r.id === draggedRoutineId);
            const targetIndex = prevRoutines.findIndex(r => r.id === targetRoutineId);

            if (draggedIndex === -1 || targetIndex === -1) {
                return prevRoutines;
            }
            
            const draggedRoutine = prevRoutines[draggedIndex];
            const targetRoutine = prevRoutines[targetIndex];

            // Only allow reordering within the same folder
            if (draggedRoutine.folderId !== targetRoutine.folderId) {
                return prevRoutines;
            }

            const newRoutines = [...prevRoutines];
            newRoutines.splice(draggedIndex, 1);
            const newTargetIndex = newRoutines.findIndex(r => r.id === targetRoutineId);
            newRoutines.splice(newTargetIndex, 0, draggedRoutine);

            return newRoutines;
        });
    }, [setRoutines]);

    const addFolder = useCallback((folder: Omit<Folder, 'id'>) => {
        setFolders(prev => [...prev, { ...folder, id: `f${Date.now()}` }]);
    }, [setFolders]);


    const updateFolder = useCallback((updatedFolder: Folder) => {
        setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
    }, [setFolders]);

    const deleteFolder = useCallback((folderId: string) => {
        setRoutines(prev => prev.map(r => r.folderId === folderId ? { ...r, folderId: null } : r));
        setFolders(prev => prev.filter(f => f.id !== folderId));
    }, [setRoutines, setFolders]);

    const logWorkout = useCallback((session: Omit<WorkoutSession, 'id'>) => {
        setWorkouts(prev => [...prev, { ...session, id: `ws${Date.now()}` }]);
    }, [setWorkouts]);
    
    const updateWorkout = useCallback((updatedWorkout: WorkoutSession) => {
        setWorkouts(prevWorkouts => prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
        setActiveWorkoutSession(null); // After updating, close the session screen
    }, [setWorkouts]);

    const deleteWorkout = useCallback((sessionId: string) => {
        setWorkouts(prev => prev.filter(w => w.id !== sessionId));
    }, [setWorkouts]);
    
    const startWorkoutFromRoutine = useCallback((routineId: string) => {
        const routine = routines.find(r => r.id === routineId);
        if (!routine) {
            console.error("Routine not found to start workout");
            return;
        }

        // Check for counterweight exercises and missing body mass
        const hasCounterweightExercise = routine.plannedExercises.some(pe => {
            const exercise = exercises.find(e => e.id === pe.exerciseId);
            return exercise?.isCounterweight;
        });

        const hasBodyMass = evaluations.some(e => e.measurements.bodyMass && e.measurements.bodyMass > 0);

        if (hasCounterweightExercise && !hasBodyMass) {
            setInfoModalContent({
                title: 'Massa Corporal Necessária',
                message: 'Esta rotina contém exercícios de contrapeso. Para calcular a carga corretamente, é necessário informar sua massa corporal. Deseja ir para a tela de Avaliação Física agora?',
                confirmText: "Ir para Avaliação",
                showCancelButton: true,
                cancelText: "Agora não",
                onConfirm: () => {
                    setActiveView(View.SETTINGS);
                    setIsPhysicalEvaluationScreenOpen(true);
                }
            });
            return; // Stop the workout from starting
        }

        const newSession: WorkoutSession = {
            id: `ws_temp_${Date.now()}`, // Temporary ID to indicate it's a new, unsaved session
            routineId: routine.id,
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
            endTime: null,
            loggedExercises: JSON.parse(JSON.stringify(routine.plannedExercises || [])),
            completed: false,
        };

        // Do NOT add to the main workouts list yet. It will be added only when 'Finish Workout' is clicked.
        setActiveWorkoutSession(newSession);
    }, [routines, exercises, evaluations, setActiveWorkoutSession, setActiveView, setIsPhysicalEvaluationScreenOpen]);

    const saveEvaluation = useCallback((evaluationToSave: Evaluation) => {
        setEvaluations(prev => {
            const existingIndex = prev.findIndex(e => e.date === evaluationToSave.date);
            const newEvals = [...prev];
            if (existingIndex > -1) {
                // Update existing
                newEvals[existingIndex] = evaluationToSave;
            } else {
                // Add new
                newEvals.push(evaluationToSave);
            }
            // Sort by date descending
            newEvals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return newEvals;
        });
    }, [setEvaluations]);

    const deleteEvaluation = useCallback((dateToDelete: string) => {
        setEvaluations(prev => prev.filter(e => e.date !== dateToDelete));
    }, [setEvaluations]);

    const contextValue = useMemo(() => ({
        exercises, setExercises,
        routines, setRoutines,
        folders, setFolders,
        workouts, setWorkouts,
        muscleGroups, setMuscleGroups,
        evaluations,
        selectedEvaluationDate, setSelectedEvaluationDate,
        activeWorkoutSession, setActiveWorkoutSession,
        editingExercise, setEditingExercise,
        isMeasurementsScreenOpen, setIsMeasurementsScreenOpen,
        isMuscleGroupsScreenOpen, setIsMuscleGroupsScreenOpen,
        isPhysicalEvaluationScreenOpen, setIsPhysicalEvaluationScreenOpen,
        isPhysicalTestsScreenOpen, setIsPhysicalTestsScreenOpen,
        theme, setTheme,
        setInfoModalContent,
        addExercise,
        updateExercise,
        deleteExercise,
        duplicateExercise,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        duplicateRoutine,
        moveRoutineToFolder,
        reorderRoutines,
        addFolder,
        updateFolder,
        deleteFolder,
        logWorkout,
        updateWorkout,
        deleteWorkout,
        addMuscleGroup,
        editMuscleGroup,
        deleteMuscleGroup,
        saveEvaluation,
        deleteEvaluation,
        startWorkoutFromRoutine,
    }), [
        exercises, routines, folders, workouts, muscleGroups, evaluations, activeWorkoutSession, editingExercise, theme, isMeasurementsScreenOpen, isMuscleGroupsScreenOpen, isPhysicalEvaluationScreenOpen, isPhysicalTestsScreenOpen, selectedEvaluationDate,
        addExercise, updateExercise, deleteExercise, duplicateExercise,
        addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, moveRoutineToFolder, reorderRoutines,
        addFolder, updateFolder, deleteFolder, 
        logWorkout, updateWorkout, deleteWorkout, 
        addMuscleGroup, editMuscleGroup, deleteMuscleGroup,
        saveEvaluation, deleteEvaluation,
        startWorkoutFromRoutine,
        setExercises, setRoutines, setFolders, setWorkouts, setMuscleGroups, setEvaluations, setTheme, setInfoModalContent, setActiveWorkoutSession, setEditingExercise, setIsMeasurementsScreenOpen, setIsMuscleGroupsScreenOpen, setIsPhysicalEvaluationScreenOpen, setIsPhysicalTestsScreenOpen, setSelectedEvaluationDate,
    ]);

    const renderContent = () => {
        if (isPhysicalTestsScreenOpen) {
            return <PhysicalTestsScreen />;
        }
        if (isPhysicalEvaluationScreenOpen) {
            return <PhysicalEvaluationScreen />;
        }
        if (isMuscleGroupsScreenOpen) {
            return <MuscleGroupsScreen />;
        }
        if (isMeasurementsScreenOpen) {
            return <MeasurementsScreen />;
        }
        if (activeWorkoutSession) {
            return <WorkoutSessionScreen />;
        }
        if (editingExercise) {
            return <ExerciseFormScreen />;
        }
        switch (activeView) {
            case View.ROUTINES: return <RoutinesScreen />;
            case View.EXERCISES: return <ExercisesScreen />;
            case View.CALENDAR: return <CalendarScreen />;
            case View.STATS: return <StatsScreen />;
            case View.SETTINGS: return <SettingsScreen />;
            default: return <RoutinesScreen />;
        }
    };

    const handleNavClick = (view: View) => {
        setActiveView(view);
    }

    const isFullScreenView = activeWorkoutSession || editingExercise || isMeasurementsScreenOpen || isMuscleGroupsScreenOpen || isPhysicalEvaluationScreenOpen || isPhysicalTestsScreenOpen;

    return (
        <AppContext.Provider value={contextValue}>
            <div className="h-full w-full bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex font-sans safe-left-padding safe-right-padding">
                {!isFullScreenView && <Sidebar activeView={activeView} setActiveView={handleNavClick} />}
                
                <div className="flex-1 flex flex-col h-full w-full max-w-full md:max-w-5xl mx-auto xl:max-w-none xl:mx-0 shadow-2xl xl:shadow-none">
                    {!isFullScreenView && (
                        <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 xl:px-6 border-b border-light-border dark:border-dark-border safe-top-padding">
                            <h1 className="text-xl font-bold text-light-text dark:text-dark-text">
                                {activeView}
                            </h1>
                            <button onClick={() => setActiveView(View.SETTINGS)} className="p-2 flex items-center justify-center xl:hidden">
                                <SettingsIcon className={`h-6 w-6 ${activeView === View.SETTINGS ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                            </button>
                        </header>
                    )}
                    
                    <main className="flex-grow min-h-0 overflow-y-auto bg-light-bg dark:bg-dark-bg">
                        {renderContent()}
                    </main>

                    {!isFullScreenView && (
                        <nav className="flex-shrink-0 bg-light-card dark:bg-dark-card h-20 flex justify-around items-center border-t border-light-border dark:border-dark-border xl:hidden safe-bottom-padding">
                            <NavItem icon={<RepeatIcon className="h-6 w-6" />} label={View.ROUTINES} activeView={activeView} onClick={handleNavClick} />
                            <NavItem icon={<DumbbellIcon className="h-6 w-6" />} label={View.EXERCISES} activeView={activeView} onClick={handleNavClick} />
                            <NavItem icon={<CalendarIcon className="h-6 w-6" />} label={View.CALENDAR} activeView={activeView} onClick={handleNavClick} />
                            <NavItem icon={<BarChartIcon className="h-6 w-6" />} label={View.STATS} activeView={activeView} onClick={handleNavClick} />
                        </nav>
                    )}
                </div>
                {infoModalContent && (
                    <ConfirmationModal
                        isOpen={true}
                        onClose={() => setInfoModalContent(null)}
                        onConfirm={() => {
                            infoModalContent.onConfirm?.();
                            setInfoModalContent(null)
                        }}
                        title={infoModalContent.title}
                        message={infoModalContent.message}
                        confirmText={infoModalContent.confirmText || "OK"}
                        cancelText={infoModalContent.cancelText || "Cancelar"}
                        showCancelButton={infoModalContent.showCancelButton ?? false}
                        variant="info"
                    />
                )}
            </div>
        </AppContext.Provider>
    );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: View;
  activeView: View;
  onClick: (view: View) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, activeView, onClick }) => {
    const isActive = activeView === label;
    return (
        <button onClick={() => onClick(label)} className="flex flex-col items-center justify-center w-1/4 h-full">
            <div className={`h-8 w-8 flex items-center justify-center ${isActive ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {icon}
            </div>
            <span className={`text-xs mt-1 font-medium ${isActive ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {label}
            </span>
        </button>
    );
};

export default App;