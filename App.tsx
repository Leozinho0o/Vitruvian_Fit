
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Exercise, Routine, Folder, WorkoutSession, Theme, UserMeasurements, Evaluation, PlannedExercise, WorkoutSet, ExerciseCategory, MeasurementType } from './types';
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
import { formatDuration } from './utils';

import { DumbbellIcon, RepeatIcon, CalendarIcon, BarChartIcon, SettingsIcon, PlayIcon } from './components/Icons';

export const AppContext = React.createContext<any>(null);
export const useApp = () => React.useContext(AppContext);

// --- IndexedDB Utility ---
const DB_NAME = 'VitruvianFitDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const dbSave = async (key: string, value: any) => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const dbGet = async (key: string, defaultValue: any) => {
    const db = await getDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
        request.onerror = () => resolve(defaultValue);
    });
};

// --- Helper for Median App Export ---
// Converts a UTF-8 string to Base64 safely
const utf8_to_b64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
};

const App: React.FC = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [activeView, setActiveView] = useState<View>(View.ROUTINES);
    
    // Core Data State
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [theme, setTheme] = useState<Theme>(Theme.SYSTEM);
    const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);

    const [isWorkoutMinimized, setIsWorkoutMinimized] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | 'new' | null>(null);
    const [isMeasurementsScreenOpen, setIsMeasurementsScreenOpen] = useState(false);
    const [isMuscleGroupsScreenOpen, setIsMuscleGroupsScreenOpen] = useState(false);
    const [isPhysicalEvaluationScreenOpen, setIsPhysicalEvaluationScreenOpen] = useState(false);
    const [isPhysicalTestsScreenOpen, setIsPhysicalTestsScreenOpen] = useState(false);
    const [selectedEvaluationDate, setSelectedEvaluationDate] = useState<string | null>(null);
    const [infoModalContent, setInfoModalContent] = useState<{ title: string; message: React.ReactNode; onConfirm?: () => void; confirmText?: string; showCancelButton?: boolean, cancelText?: string; } | null>(null);

    // Initial Load & Migration from LocalStorage
    useEffect(() => {
        const init = async () => {
            const keys = [
                { key: 'vitruvian_fit_exercises', def: INITIAL_EXERCISES, setter: setExercises },
                { key: 'vitruvian_fit_routines', def: INITIAL_ROUTINES, setter: setRoutines },
                { key: 'vitruvian_fit_folders', def: INITIAL_FOLDERS, setter: setFolders },
                { key: 'vitruvian_fit_workouts', def: [], setter: setWorkouts },
                { key: 'vitruvian_fit_muscleGroups', def: DEFAULT_MUSCLE_GROUPS, setter: setMuscleGroups },
                { key: 'vitruvian_fit_evaluations', def: [], setter: setEvaluations },
                { key: 'vitruvian_fit_theme', def: Theme.SYSTEM, setter: setTheme },
                { key: 'vitruvian_fit_active_workout', def: null, setter: setActiveWorkoutSession }
            ];

            for (const item of keys) {
                // Try IndexedDB first
                let data = await dbGet(item.key, undefined);
                
                // If not in IndexedDB, check LocalStorage for migration
                if (data === undefined) {
                    const localData = localStorage.getItem(item.key);
                    if (localData) {
                        try {
                            data = JSON.parse(localData);
                            // Migrate to IndexedDB for next time
                            await dbSave(item.key, data);
                            console.log(`Migrated ${item.key} to IndexedDB`);
                        } catch (e) {
                            data = item.def;
                        }
                    } else {
                        data = item.def;
                    }
                }
                // Fix: Cast setter to any to bypass strict union call checking in the loop
                (item.setter as any)(data);
            }
            setIsLoaded(true);
        };
        init();
    }, []);

    // Persistence Layer (Saves to IndexedDB on every state change)
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_exercises', exercises); }, [exercises, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_routines', routines); }, [routines, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_folders', folders); }, [folders, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_workouts', workouts); }, [workouts, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_muscleGroups', muscleGroups); }, [muscleGroups, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_evaluations', evaluations); }, [evaluations, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_theme', theme); }, [theme, isLoaded]);
    useEffect(() => { if (isLoaded) dbSave('vitruvian_fit_active_workout', activeWorkoutSession); }, [activeWorkoutSession, isLoaded]);

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
    }, []);

    const updateExercise = useCallback((updatedExercise: Exercise) => {
        setExercises(prev => prev.map(e => e.id === updatedExercise.id ? updatedExercise : e));
    }, []);
    
    const duplicateExercise = useCallback((exerciseId: string) => {
        setExercises(prevExercises => {
            const exerciseToDuplicate = prevExercises.find(e => e.id === exerciseId);
            if (!exerciseToDuplicate) return prevExercises;

            const newExercise: Exercise = {
                ...JSON.parse(JSON.stringify(exerciseToDuplicate)),
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
    }, []);

    const deleteExercise = useCallback((exerciseId: string) => {
        setExercises(prev => prev.filter(e => e.id !== exerciseId));
        setRoutines(prev => prev.map(r => ({
            ...r,
            plannedExercises: r.plannedExercises.filter(pe => pe.exerciseId !== exerciseId)
        })));
    }, []);
    
    const addMuscleGroup = useCallback((group: string) => {
        setMuscleGroups(prev => {
           const newGroup = group.trim();
           if (newGroup && !prev.includes(newGroup)) {
               return [...prev, newGroup].sort();
           }
           return prev;
        });
    }, []);

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
    }, []);

    const deleteMuscleGroup = useCallback((nameToDelete: string) => {
        setMuscleGroups(prev => prev.filter(m => m !== nameToDelete));
        setExercises(prev => prev.map(ex => ({
            ...ex,
            primaryMuscles: ex.primaryMuscles.filter(m => m !== nameToDelete),
            secondaryMuscles: ex.secondaryMuscles.filter(m => m !== nameToDelete),
        })));
    }, []);

    const addRoutine = useCallback((routine: Omit<Routine, 'id'>) => {
        setRoutines(prev => [...prev, { ...routine, id: `r${Date.now()}` }]);
    }, []);

    const updateRoutine = useCallback((updatedRoutine: Routine) => {
        setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutine : r));
    }, []);

    const deleteRoutine = useCallback((routineId: string) => {
        setRoutines(prev => prev.filter(r => r.id !== routineId));
        setWorkouts(prev => prev.filter(w => w.routineId !== routineId));
    }, []);

    const duplicateRoutine = useCallback((routineId: string) => {
        setRoutines(prevRoutines => {
            const routineToDuplicate = prevRoutines.find(r => r.id === routineId);
            if (!routineToDuplicate) return prevRoutines;
            const newRoutine: Routine = {
                ...JSON.parse(JSON.stringify(routineToDuplicate)),
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
    }, []);
    
    const moveRoutineToFolder = useCallback((routineId: string, folderId: string | null) => {
        setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, folderId } : r));
    }, []);

    const reorderRoutines = useCallback((draggedRoutineId: string, targetRoutineId: string, position: 'top' | 'bottom') => {
        setRoutines((prevRoutines: Routine[]) => {
            const routinesCopy = [...prevRoutines];
            const draggedIndex = routinesCopy.findIndex(r => r.id === draggedRoutineId);
            let targetIndex = routinesCopy.findIndex(r => r.id === targetRoutineId);
            if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return prevRoutines;
            const draggedRoutine = { ...routinesCopy[draggedIndex] };
            const targetRoutine = routinesCopy[targetIndex];
            if (draggedRoutine.folderId !== targetRoutine.folderId) draggedRoutine.folderId = targetRoutine.folderId;
            routinesCopy.splice(draggedIndex, 1);
            targetIndex = routinesCopy.findIndex(r => r.id === targetRoutineId);
            const insertIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;
            routinesCopy.splice(insertIndex, 0, draggedRoutine);
            return routinesCopy;
        });
    }, []);

    const addFolder = useCallback((folder: Omit<Folder, 'id'>) => {
        setFolders(prev => [...prev, { ...folder, id: `f${Date.now()}` }]);
    }, []);

    const updateFolder = useCallback((updatedFolder: Folder) => {
        setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
    }, []);

    const deleteFolder = useCallback((folderId: string) => {
        setRoutines(prev => prev.map(r => r.folderId === folderId ? { ...r, folderId: null } : r));
        setFolders(prev => prev.filter(f => f.id !== folderId));
    }, []);

    const reorderFolders = useCallback((draggedFolderId: string, targetFolderId: string, position: 'top' | 'bottom') => {
        setFolders((prevFolders: Folder[]) => {
            const foldersCopy = [...prevFolders];
            const draggedIndex = foldersCopy.findIndex(f => f.id === draggedFolderId);
            let targetIndex = foldersCopy.findIndex(f => f.id === targetFolderId);
            if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return prevFolders;
            const [reorderedItem] = foldersCopy.splice(draggedIndex, 1);
            targetIndex = foldersCopy.findIndex(f => f.id === targetFolderId);
            const insertIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;
            foldersCopy.splice(insertIndex, 0, reorderedItem);
            return foldersCopy;
        });
    }, []);

    const logWorkout = useCallback((session: Omit<WorkoutSession, 'id'>) => {
        setWorkouts(prev => [...prev, { ...session, id: `ws${Date.now()}` }]);
        setActiveWorkoutSession(null);
        setIsWorkoutMinimized(false);
    }, []);
    
    const updateWorkout = useCallback((updatedWorkout: WorkoutSession) => {
        setWorkouts(prevWorkouts => prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
        setActiveWorkoutSession(null);
        setIsWorkoutMinimized(false);
    }, []);

    const deleteWorkout = useCallback((sessionId: string) => {
        setWorkouts(prev => prev.filter(w => w.id !== sessionId));
    }, []);
    
    const startWorkoutFromRoutine = useCallback((routineId: string) => {
        const routine = routines.find(r => r.id === routineId);
        if (!routine) return;

        const hasCounterweightExercise = routine.plannedExercises.some(pe => {
            const exercise = exercises.find(e => e.id === pe.exerciseId);
            return exercise?.isCounterweight;
        });
        const hasBodyMass = evaluations.some(e => e.measurements.bodyMass && e.measurements.bodyMass > 0);

        if (hasCounterweightExercise && !hasBodyMass) {
            setInfoModalContent({
                title: 'Massa Corporal Necessária',
                message: 'Esta rotina contém exercícios de contrapeso. É necessário informar sua massa corporal na Avaliação Física.',
                confirmText: "Ir para Avaliação",
                showCancelButton: true,
                cancelText: "Agora não",
                onConfirm: () => {
                    setActiveView(View.SETTINGS);
                    setIsPhysicalEvaluationScreenOpen(true);
                }
            });
            return;
        }

        const originalPlan = JSON.parse(JSON.stringify(routine.plannedExercises || []));
        const newSession: WorkoutSession = {
            id: `ws_temp_${Date.now()}`,
            routineId: routine.id,
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
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
        setActiveWorkoutSession(newSession);
        setIsWorkoutMinimized(false);
    }, [routines, exercises, evaluations]);

    const startFiveMinTest = useCallback((exerciseId: string) => {
        const ex = exercises.find(e => e.id === exerciseId);
        if (!ex) return;
        const newSession: WorkoutSession = {
            id: `ws_test_5min_${Date.now()}`,
            routineId: 'internal_test',
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
            endTime: null,
            loggedExercises: [{ exerciseId: ex.id, tempId: `le-test-${Date.now()}`, notes: 'Protocolo: Teste de 5 minutos', sets: [{ time: 300, completed: false }] }],
            completed: false,
        };
        setActiveWorkoutSession(newSession);
        setIsWorkoutMinimized(false);
        setIsPhysicalTestsScreenOpen(false);
    }, [exercises]);

    const startIncrementalTest = useCallback((exerciseId: string) => {
        const ex = exercises.find(e => e.id === exerciseId);
        if (!ex) return;
        const stages: WorkoutSet[] = Array.from({ length: 10 }, () => ({ time: 60, completed: false }));
        const newSession: WorkoutSession = {
            id: `ws_test_inc_${Date.now()}`,
            routineId: 'internal_test',
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
            endTime: null,
            loggedExercises: [{ exerciseId: ex.id, tempId: `le-test-${Date.now()}`, notes: 'Protocolo: Teste Incremental', sets: stages }],
            completed: false,
        };
        setActiveWorkoutSession(newSession);
        setIsWorkoutMinimized(false);
        setIsPhysicalTestsScreenOpen(false);
    }, [exercises]);

    const startOneRMTest = useCallback((exerciseId: string) => {
        const ex = exercises.find(e => e.id === exerciseId);
        if (!ex) return;
        const sets: WorkoutSet[] = [
            { reps: 10, effort: '4', completed: false },
            { reps: 5, effort: '6', completed: false },
            { reps: 1, effort: '9', completed: false },
            { reps: 1, effort: '10', completed: false },
            { reps: 1, effort: '10', completed: false },
        ];
        const newSession: WorkoutSession = {
            id: `ws_test_1rm_${Date.now()}`,
            routineId: 'internal_test',
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
            endTime: null,
            loggedExercises: [{ exerciseId: ex.id, tempId: `le-test-1rm-${Date.now()}`, notes: 'Protocolo: Teste de 1RM Real', sets: sets }],
            completed: false,
        };
        setActiveWorkoutSession(newSession);
        setIsWorkoutMinimized(false);
        setIsPhysicalTestsScreenOpen(false);
    }, [exercises]);

    const saveEvaluation = useCallback((evaluationToSave: Evaluation) => {
        setEvaluations(prev => {
            const existingIndex = prev.findIndex(e => e.date === evaluationToSave.date);
            const newEvals = [...prev];
            if (existingIndex > -1) newEvals[existingIndex] = evaluationToSave;
            else newEvals.push(evaluationToSave);
            newEvals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return newEvals;
        });
    }, []);

    const deleteEvaluation = useCallback((dateToDelete: string) => {
        setEvaluations(prev => prev.filter(e => e.date !== dateToDelete));
    }, []);

    const exportData = useCallback(() => {
        const data = { version: '1.1', app: 'Vitruvian Fit', exportedAt: new Date().toISOString(), exercises, routines, folders, workouts, muscleGroups, evaluations };
        const jsonString = JSON.stringify(data, null, 2);
        const fileName = `vitruvian_fit_backup_${new Date().toISOString().split('T')[0]}.json`;

        // Check for Median (GoNative) app environment
        if ((window as any).median) {
            const base64 = utf8_to_b64(jsonString);
            (window as any).median.share.shareFile({
                base64: base64,
                filename: fileName,
                mimetype: 'application/json',
                displayName: fileName
            });
            return;
        }

        // Web Fallback
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [exercises, routines, folders, workouts, muscleGroups, evaluations]);

    const exportExerciseList = useCallback(() => {
        const resistedExercises = exercises.filter(ex => ex.category === ExerciseCategory.RESISTED);
        let content = `LISTA DE EXERCÍCIOS RESISTIDOS - VITRUVIAN FIT\n`;
        content += `Exportado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
        content += `================================================================\n\n`;

        resistedExercises.forEach((ex, index) => {
            content += `${index + 1}. ${ex.name.toUpperCase()}\n`;
            content += `   GRUPOS PRIMÁRIOS: ${ex.primaryMuscles.join(', ')}\n`;
            content += `   GRUPOS SECUNDÁRIOS: ${ex.secondaryMuscles.length > 0 ? ex.secondaryMuscles.join(', ') : 'Nenhum'}\n`;
            content += `   TIPO DE MEDIDA: ${ex.measurementType}\n`;
            content += `   UNIDADE: ${ex.unit}\n`;
            if (ex.notes) content += `   ANOTAÇÕES: ${ex.notes}\n`;
            content += `----------------------------------------------------------------\n\n`;
        });

        const fileName = `exercicios_resistidos_vitruvian_fit.txt`;

        // Check for Median (GoNative) app environment
        if ((window as any).median) {
            const base64 = utf8_to_b64(content);
            (window as any).median.share.shareFile({
                base64: base64,
                filename: fileName,
                mimetype: 'text/plain',
                displayName: fileName
            });
            return;
        }

        // Web Fallback
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [exercises]);

    const importData = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.app !== 'Vitruvian Fit') throw new Error('Arquivo inválido.');
                if (window.confirm('Isso irá sobrescrever seus dados atuais. Continuar?')) {
                    setExercises(data.exercises || []);
                    setRoutines(data.routines || []);
                    setFolders(data.folders || []);
                    setWorkouts(data.workouts || []);
                    setMuscleGroups(data.muscleGroups || DEFAULT_MUSCLE_GROUPS);
                    setEvaluations(data.evaluations || []);
                    alert('Dados importados com sucesso!');
                    window.location.reload();
                }
            } catch (err) {
                alert('Erro ao importar backup.');
            }
        };
        reader.readAsText(file);
    }, []);

    const contextValue = useMemo(() => ({
        exercises, setExercises, routines, setRoutines, folders, setFolders, workouts, setWorkouts, muscleGroups, setMuscleGroups, evaluations, selectedEvaluationDate, setSelectedEvaluationDate, activeWorkoutSession, setActiveWorkoutSession, isWorkoutMinimized, setIsWorkoutMinimized, editingExercise, setEditingExercise, isMeasurementsScreenOpen, setIsMeasurementsScreenOpen, isMuscleGroupsScreenOpen, setIsMuscleGroupsScreenOpen, isPhysicalEvaluationScreenOpen, setIsPhysicalEvaluationScreenOpen, isPhysicalTestsScreenOpen, setIsPhysicalTestsScreenOpen, theme, setTheme, setInfoModalContent, addExercise, updateExercise, deleteExercise, duplicateExercise, addMuscleGroup, editMuscleGroup, deleteMuscleGroup, addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, moveRoutineToFolder, reorderRoutines, addFolder, updateFolder, deleteFolder, reorderFolders, logWorkout, updateWorkout, deleteWorkout, saveEvaluation, deleteEvaluation, startWorkoutFromRoutine, startFiveMinTest, startIncrementalTest, startOneRMTest, exportData, importData, exportExerciseList
    }), [exercises, routines, folders, workouts, muscleGroups, evaluations, activeWorkoutSession, isWorkoutMinimized, editingExercise, theme, isMeasurementsScreenOpen, isMuscleGroupsScreenOpen, isPhysicalEvaluationScreenOpen, isPhysicalTestsScreenOpen, selectedEvaluationDate, addExercise, updateExercise, deleteExercise, duplicateExercise, addMuscleGroup, editMuscleGroup, deleteMuscleGroup, addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, moveRoutineToFolder, reorderRoutines, addFolder, updateFolder, deleteFolder, reorderFolders, logWorkout, updateWorkout, deleteWorkout, saveEvaluation, deleteEvaluation, startWorkoutFromRoutine, startFiveMinTest, startIncrementalTest, startOneRMTest, exportData, importData, exportExerciseList]);

    if (!isLoaded) {
        return (
            <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <DumbbellIcon className="h-12 w-12 text-primary animate-bounce" />
                    <p className="text-light-text dark:text-dark-text font-bold">Carregando Vitruvian Fit...</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (isPhysicalTestsScreenOpen) return <PhysicalTestsScreen />;
        if (isPhysicalEvaluationScreenOpen) return <PhysicalEvaluationScreen />;
        if (isMuscleGroupsScreenOpen) return <MuscleGroupsScreen />;
        if (isMeasurementsScreenOpen) return <MeasurementsScreen />;
        if (activeWorkoutSession && !isWorkoutMinimized) return <WorkoutSessionScreen />;
        if (editingExercise) return <ExerciseFormScreen />;
        switch (activeView) {
            case View.ROUTINES: return <RoutinesScreen />;
            case View.EXERCISES: return <ExercisesScreen />;
            case View.CALENDAR: return <CalendarScreen />;
            case View.STATS: return <StatsScreen />;
            case View.SETTINGS: return <SettingsScreen />;
            default: return <RoutinesScreen />;
        }
    };

    const isFullScreenView = (activeWorkoutSession && !isWorkoutMinimized) || editingExercise || isMeasurementsScreenOpen || isMuscleGroupsScreenOpen || isPhysicalEvaluationScreenOpen || isPhysicalTestsScreenOpen;

    return (
        <AppContext.Provider value={contextValue}>
            <div className="h-full w-full bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex font-sans safe-left-padding safe-right-padding">
                {!isFullScreenView && <Sidebar activeView={activeView} setActiveView={setActiveView} />}
                <div className="flex-1 flex flex-col h-full w-full max-w-full md:max-w-5xl mx-auto xl:max-w-none xl:mx-0 shadow-2xl xl:shadow-none relative">
                    {!isFullScreenView && (
                        <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 xl:px-6 border-b border-light-border dark:border-dark-border safe-top-padding">
                            <h1 className="text-xl font-bold">{activeView}</h1>
                            <button onClick={() => setActiveView(View.SETTINGS)} className="p-2 flex items-center justify-center xl:hidden">
                                <SettingsIcon className={`h-6 w-6 ${activeView === View.SETTINGS ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                            </button>
                        </header>
                    )}
                    <main className="flex-grow min-h-0 overflow-y-auto bg-light-bg dark:bg-dark-bg">{renderContent()}</main>
                    {!isFullScreenView && activeWorkoutSession && isWorkoutMinimized && (
                        <MinimizedWorkoutBar session={activeWorkoutSession} routine={routines.find((r: Routine) => r.id === activeWorkoutSession.routineId)} onClick={() => setIsWorkoutMinimized(false)} />
                    )}
                    {!isFullScreenView && (
                        <nav className="flex-shrink-0 bg-light-card dark:bg-dark-card h-20 flex justify-around items-center border-t border-light-border dark:border-dark-border xl:hidden safe-bottom-padding">
                            <NavItem icon={<RepeatIcon className="h-6 w-6" />} label={View.ROUTINES} activeView={activeView} onClick={setActiveView} />
                            <NavItem icon={<DumbbellIcon className="h-6 w-6" />} label={View.EXERCISES} activeView={activeView} onClick={setActiveView} />
                            <NavItem icon={<CalendarIcon className="h-6 w-6" />} label={View.CALENDAR} activeView={activeView} onClick={setActiveView} />
                            <NavItem icon={<BarChartIcon className="h-6 w-6" />} label={View.STATS} activeView={activeView} onClick={setActiveView} />
                        </nav>
                    )}
                </div>
                {infoModalContent && (
                    <ConfirmationModal isOpen={true} onClose={() => setInfoModalContent(null)} onConfirm={() => { infoModalContent.onConfirm?.(); setInfoModalContent(null) }} title={infoModalContent.title} message={infoModalContent.message} confirmText={infoModalContent.confirmText || "OK"} cancelText={infoModalContent.cancelText || "Cancelar"} showCancelButton={infoModalContent.showCancelButton ?? false} variant="info" />
                )}
            </div>
        </AppContext.Provider>
    );
};

const MinimizedWorkoutBar: React.FC<{ session: WorkoutSession; routine: Routine | undefined; onClick: () => void }> = ({ session, routine, onClick }) => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const update = () => {
            const startTimestamp = new Date(session.startTime).getTime();
            setElapsed(Math.floor((Date.now() - startTimestamp) / 1000));
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [session.startTime]);
    return (
        <div onClick={onClick} className="mx-4 mb-2 bg-secondary text-white p-3 rounded-lg shadow-lg flex items-center justify-between cursor-pointer animate-bounce-subtle">
            <div className="flex items-center">
                <PlayIcon className="h-5 w-5 mr-3 fill-current" />
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80">Treino em andamento</p>
                    <p className="font-bold truncate">{routine?.name || 'Sessão de Treino'}</p>
                </div>
            </div>
            <div className="text-xl font-black tabular-nums">{formatDuration(elapsed)}</div>
        </div>
    );
};

interface NavItemProps { icon: React.ReactNode; label: View; activeView: View; onClick: (view: View) => void; }
const NavItem: React.FC<NavItemProps> = ({ icon, label, activeView, onClick }) => {
    const isActive = activeView === label;
    return (
        <button onClick={() => onClick(label)} className="flex flex-col items-center justify-center w-1/4 h-full">
            <div className={`h-8 w-8 flex items-center justify-center ${isActive ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{icon}</div>
            <span className={`text-xs mt-1 font-medium ${isActive ? 'text-secondary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{label}</span>
        </button>
    );
};

export default App;
