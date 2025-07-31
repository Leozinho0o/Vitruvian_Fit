
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Routine, Folder, Exercise, ExerciseCategory, PlannedExercise, WorkoutSet, MeasurementType, Unit, PerceivedExertionScale } from '../types';
import { FolderIcon, PlusIcon, PencilIcon, TrashIcon, XIcon, ChevronRightIcon, PlayIcon, CheckCircleIcon, CopyIcon, SearchIcon, InfoIcon, DumbbellIcon } from '../components/Icons';
import { ROUTINE_COLORS, getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, parseTimeToSeconds } from '../utils';
import FolderStatsModal from '../components/FolderStatsModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';


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


// Main Component
const RoutinesScreen = () => {
    const { routines, folders, exercises, addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, addFolder, updateFolder, deleteFolder, moveRoutineToFolder, startWorkoutFromRoutine } = useApp();

    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);
    const [folderForStats, setFolderForStats] = useState<Folder | null>(null);
    
    const [confirmDeleteRoutineInfo, setConfirmDeleteRoutineInfo] = useState<{ id: string; name: string } | null>(null);
    const [confirmDeleteFolderInfo, setConfirmDeleteFolderInfo] = useState<{ id: string; name: string } | null>(null);
    
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const addOptionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isAddOptionsOpen && addOptionsRef.current && !addOptionsRef.current.contains(event.target as Node)) {
                setIsAddOptionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAddOptionsOpen]);


    const { finalFolders, finalRoutines } = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
            return { finalFolders: folders, finalRoutines: routines };
        }
        
        const matchingRoutines = routines.filter(r => r.name.toLowerCase().includes(query));
        const matchingFolders = folders.filter(f => f.name.toLowerCase().includes(query));
        const matchingFolderIds = new Set(matchingFolders.map(f => f.id));

        const foldersWithMatchingRoutines = folders.filter(f => 
            matchingRoutines.some(r => r.folderId === f.id)
        );
        const finalFolders = [...new Map([...matchingFolders, ...foldersWithMatchingRoutines].map(f => [f.id, f])).values()];

        const routinesInMatchingFolders = routines.filter(r => r.folderId && matchingFolderIds.has(r.folderId));
        const finalRoutines = [...new Map([...matchingRoutines, ...routinesInMatchingFolders].map(r => [r.id, r])).values()];

        return { finalFolders, finalRoutines };
    }, [searchQuery, routines, folders]);

    const routinesByFolder = useMemo(() => {
        const map = new Map<string, Routine[]>();
        finalRoutines.forEach((routine: Routine) => {
            const folderId = routine.folderId || 'root';
            if (!map.has(folderId)) {
                map.set(folderId, []);
            }
            map.get(folderId)?.push(routine);
        });
        return map;
    }, [finalRoutines]);

    const rootRoutines = routinesByFolder.get('root') || [];

    const hasOriginalContent = routines.length > 0 || folders.length > 0;
    const hasSearchResults = finalFolders.length > 0 || rootRoutines.length > 0;

    const handleConfirmDeleteRoutine = () => {
        if (confirmDeleteRoutineInfo) {
            deleteRoutine(confirmDeleteRoutineInfo.id);
            setConfirmDeleteRoutineInfo(null);
        }
    };
    const handleConfirmDeleteFolder = () => {
        if (confirmDeleteFolderInfo) {
            deleteFolder(confirmDeleteFolderInfo.id);
            setConfirmDeleteFolderInfo(null);
        }
    };

    // --- Event Handlers ---
    const handleOpenAddRoutine = () => {
        setEditingRoutine(null);
        setIsRoutineModalOpen(true);
        setIsAddOptionsOpen(false);
    }
    const handleOpenAddFolder = () => {
        setEditingFolder(null);
        setIsFolderModalOpen(true);
        setIsAddOptionsOpen(false);
    }
    
    const handleDropOnRoot = (e: React.DragEvent) => {
        e.preventDefault();
        const routineId = e.dataTransfer.getData('text/plain');
        moveRoutineToFolder(routineId, null);
        setDropTarget(null);
    }

    return (
        <div 
            className="relative h-full"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnRoot}
        >
            <div className="p-4 lg:p-6 space-y-4 pb-40">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <input
                            type="text"
                            placeholder="Pesquisar rotinas ou pastas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg py-2 pl-10 pr-4 text-light-text dark:text-dark-text focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                            aria-label="Pesquisar rotinas e pastas"
                        />
                    </div>
                    {/* Desktop Add Button */}
                    <div className="hidden lg:block ml-4 relative" ref={addOptionsRef}>
                        <button
                            onClick={() => setIsAddOptionsOpen(prev => !prev)}
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center"
                            aria-haspopup="true"
                            aria-expanded={isAddOptionsOpen}
                        >
                            <PlusIcon className="h-5 w-5 mr-2" />
                            Adicionar
                        </button>
                        {isAddOptionsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-light-card dark:bg-dark-card rounded-lg shadow-xl z-20 border border-light-border dark:border-dark-border p-1">
                                <button onClick={handleOpenAddRoutine} className="w-full text-left flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                                    <div className="h-4 w-4 rounded-sm bg-secondary mr-3 flex-shrink-0"></div>
                                    Nova Rotina
                                </button>
                                <button onClick={handleOpenAddFolder} className="w-full text-left flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                                    <FolderIcon className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0" />
                                    Nova Pasta
                                </button>
                            </div>
                        )}
                    </div>
                </div>


                {finalFolders.map((folder: Folder) => (
                    <FolderItem
                        key={folder.id}
                        folder={folder}
                        routines={routinesByFolder.get(folder.id) || []}
                        onEditRoutine={(e, routine) => {
                            e.stopPropagation();
                            setEditingRoutine(routine);
                            setIsRoutineModalOpen(true);
                        }}
                        onDeleteRoutine={(e, routine) => {
                            e.stopPropagation();
                            setConfirmDeleteRoutineInfo({ id: routine.id, name: routine.name });
                        }}
                        onDuplicateRoutine={(e, routineId) => {
                            e.stopPropagation();
                            duplicateRoutine(routineId);
                        }}
                        onStartWorkout={(e, routineId) => {
                            e.stopPropagation();
                            startWorkoutFromRoutine(routineId);
                        }}
                        onEditFolder={(e) => {
                            e.stopPropagation();
                            setEditingFolder(folder);
                            setIsFolderModalOpen(true);
                        }}
                        onDeleteFolder={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteFolderInfo({ id: folder.id, name: folder.name });
                        }}
                        onShowStats={(e) => {
                            e.stopPropagation();
                            setFolderForStats(folder);
                        }}
                        isDropTarget={dropTarget === folder.id}
                        setDropTarget={setDropTarget}
                    />
                ))}
                {rootRoutines.map((routine: Routine) => (
                    <RoutineItem 
                        key={routine.id}
                        routine={routine}
                        onEdit={(e) => {
                             e.stopPropagation();
                            setEditingRoutine(routine);
                            setIsRoutineModalOpen(true);
                        }}
                        onDelete={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteRoutineInfo({ id: routine.id, name: routine.name });
                        }}
                        onDuplicate={(e) => {
                            e.stopPropagation();
                            duplicateRoutine(routine.id);
                        }}
                        onStartWorkout={(e) => {
                            e.stopPropagation();
                            startWorkoutFromRoutine(routine.id);
                        }}
                    />
                ))}
                {searchQuery === '' && !hasOriginalContent && (
                     <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10">
                        <p>Nenhuma rotina ou pasta criada.</p>
                        <p>Clique no botão '+' para começar.</p>
                    </div>
                )}
                {searchQuery !== '' && !hasSearchResults && (
                     <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10">
                        <p>Nenhum resultado encontrado para "{searchQuery}".</p>
                    </div>
                )}
            </div>

            {/* FAB and Add Options for Mobile */}
            <div className="fixed bottom-28 right-6 z-20 lg:hidden" ref={addOptionsRef}>
                <div className="flex flex-col items-end">
                    {isAddOptionsOpen && (
                        <div className="flex flex-col items-end mb-2">
                            <button onClick={handleOpenAddRoutine} className="flex items-center bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg mb-2 w-max">
                                <span className="text-light-text dark:text-dark-text mr-2">Nova Rotina</span>
                                <div className="h-4 w-4 rounded-sm bg-secondary"></div>
                            </button>
                            <button onClick={handleOpenAddFolder} className="flex items-center bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg w-max">
                                <span className="text-light-text dark:text-dark-text mr-2">Nova Pasta</span>
                                <FolderIcon className="h-5 w-5 text-yellow-400" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setIsAddOptionsOpen(prev => !prev)}
                        className="bg-secondary hover:bg-pink-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center"
                        aria-label="Adicionar item"
                    >
                        <PlusIcon className={`h-8 w-8 transition-transform duration-200 ${isAddOptionsOpen ? 'rotate-45' : ''}`} />
                    </button>
                </div>
            </div>
            
            {/* Modals */}
            {isRoutineModalOpen && (
                <RoutineFormModal 
                    onClose={() => setIsRoutineModalOpen(false)}
                    onSave={(data) => {
                        if(editingRoutine) {
                            updateRoutine({ ...data, id: editingRoutine.id });
                        } else {
                            addRoutine(data as Omit<Routine, 'id'>);
                        }
                        setIsRoutineModalOpen(false);
                    }}
                    routineToEdit={editingRoutine}
                    allExercises={exercises}
                    allFolders={folders}
                />
            )}
            {isFolderModalOpen && (
                 <FolderFormModal 
                    onClose={() => setIsFolderModalOpen(false)}
                    onSave={(data) => {
                        if(editingFolder) {
                            updateFolder({ ...data, id: editingFolder.id, parentId: null });
                        } else {
                            addFolder({ ...data, parentId: null });
                        }
                        setIsFolderModalOpen(false);
                    }}
                    folderToEdit={editingFolder}
                />
            )}
            {folderForStats && (
                <FolderStatsModal
                    folder={folderForStats}
                    routines={routines}
                    exercises={exercises}
                    onClose={() => setFolderForStats(null)}
                />
            )}
            {confirmDeleteRoutineInfo && (
                <ConfirmationModal
                    isOpen={!!confirmDeleteRoutineInfo}
                    onClose={() => setConfirmDeleteRoutineInfo(null)}
                    onConfirm={handleConfirmDeleteRoutine}
                    title="Confirmar Exclusão"
                    message={<>Tem certeza que deseja apagar a rotina <strong>"{confirmDeleteRoutineInfo.name}"</strong>? Esta ação não pode ser desfeita.</>}
                />
            )}
            {confirmDeleteFolderInfo && (
                <ConfirmationModal
                    isOpen={!!confirmDeleteFolderInfo}
                    onClose={() => setConfirmDeleteFolderInfo(null)}
                    onConfirm={handleConfirmDeleteFolder}
                    title="Confirmar Exclusão"
                    message={<>
                        <p>Tem certeza que deseja apagar a pasta <strong>"{confirmDeleteFolderInfo.name}"</strong>?</p>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">As rotinas dentro dela não serão apagadas, mas movidas para fora da pasta.</p>
                    </>}
                />
            )}
        </div>
    );
};

interface FolderItemProps {
    folder: Folder;
    routines: Routine[];
    onEditRoutine: (e: React.MouseEvent, routine: Routine) => void;
    onDeleteRoutine: (e: React.MouseEvent, routine: Routine) => void;
    onDuplicateRoutine: (e: React.MouseEvent, routineId: string) => void;
    onStartWorkout: (e: React.MouseEvent, routineId: string) => void;
    onEditFolder: (e: React.MouseEvent) => void;
    onDeleteFolder: (e: React.MouseEvent) => void;
    onShowStats: (e: React.MouseEvent) => void;
    isDropTarget: boolean;
    setDropTarget: (id: string | null) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, routines, onEditRoutine, onDeleteRoutine, onDuplicateRoutine, onStartWorkout, onEditFolder, onDeleteFolder, onShowStats, isDropTarget, setDropTarget }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const { moveRoutineToFolder } = useApp();
    const dropRef = React.useRef<HTMLDivElement>(null);


    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(folder.id);
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
            setDropTarget(null);
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const routineId = e.dataTransfer.getData('text/plain');
        if (routineId) {
             const droppedRoutine = routines.find(r => r.id === routineId);
             if(!droppedRoutine || droppedRoutine.folderId !== folder.id){
                moveRoutineToFolder(routineId, folder.id);
             }
        }
        setDropTarget(null);
    }

    return (
        <div 
            ref={dropRef}
            className={`bg-light-card dark:bg-dark-card rounded-lg border-2 transition-colors ${isDropTarget ? 'border-primary bg-primary/20' : 'border-transparent'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center">
                    <FolderIcon className="h-6 w-6 mr-3 text-yellow-400" />
                    <span className="font-bold text-lg text-light-text dark:text-dark-text">{folder.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={onShowStats} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 dark:hover:text-blue-400"><InfoIcon className="h-5 w-5" /></button>
                    <button onClick={onEditFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={onDeleteFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                    <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="pl-6 pr-3 pb-3 space-y-2">
                    {routines.map(routine => (
                        <RoutineItem 
                            key={routine.id}
                            routine={routine}
                            onEdit={(e) => onEditRoutine(e, routine)}
                            onDelete={(e) => onDeleteRoutine(e, routine)}
                            onDuplicate={(e) => onDuplicateRoutine(e, routine.id)}
                            onStartWorkout={(e) => onStartWorkout(e, routine.id)}
                        />
                    ))}
                    {routines.length === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary pl-4 py-2">Esta pasta está vazia. Arraste uma rotina aqui.</p>}
                </div>
            )}
        </div>
    );
};

interface RoutineItemProps {
    routine: Routine;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onDuplicate: (e: React.MouseEvent) => void;
    onStartWorkout: (e: React.MouseEvent) => void;
}

const RoutineItem: React.FC<RoutineItemProps> = ({ routine, onEdit, onDelete, onDuplicate, onStartWorkout }) => {
    
    return (
        <div 
            className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex items-start justify-between cursor-grab"
            draggable="true"
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', routine.id);
                e.dataTransfer.effectAllowed = "move";
            }}
        >
            <div className="flex-grow pr-2">
                <div className="flex items-center">
                    <span className="h-4 w-4 rounded-sm mr-4 flex-shrink-0" style={{ backgroundColor: routine.color }}></span>
                    <span className="font-semibold text-light-text dark:text-dark-text">{routine.name}</span>
                </div>
                {routine.notes && (
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2 pl-8 italic">
                        "{routine.notes}"
                    </p>
                )}
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                    onClick={onStartWorkout}
                    className="p-2 flex items-center justify-center text-secondary hover:text-pink-700"
                    aria-label={`Iniciar treino ${routine.name}`}
                >
                    <PlayIcon className="h-5 w-5" />
                </button>
                <button onClick={onEdit} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"><PencilIcon className="h-5 w-5" /></button>
                <button onClick={onDuplicate} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-dark-text"><CopyIcon className="h-5 w-5" /></button>
                <button onClick={onDelete} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
            </div>
        </div>
    );
};

interface FolderFormModalProps {
    onClose: () => void;
    onSave: (data: { name: string }) => void;
    folderToEdit: Folder | null;
}

const FolderFormModal: React.FC<FolderFormModalProps> = ({ onClose, onSave, folderToEdit }) => {
    const [name, setName] = useState(folderToEdit?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave({ name: name.trim() });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{folderToEdit ? 'Editar Pasta' : 'Nova Pasta'}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="folderName" className="block text-sm font-medium mb-1">Nome da Pasta</label>
                        <input
                            type="text"
                            id="folderName"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                        />
                    </div>
                    <div className="pt-2 flex justify-end items-center space-x-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ExercisePickerModalProps {
    onClose: () => void;
    onSelect: (exerciseId: string) => void;
    allExercises: Exercise[];
    plannedExercises: PlannedExercise[];
}

const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ onClose, onSelect, allExercises, plannedExercises }) => {
    const exercisesByCategory = useMemo(() => {
        return allExercises.reduce((acc, exercise) => {
            if (!acc[exercise.category]) acc[exercise.category] = [];
            acc[exercise.category].push(exercise);
            return acc;
        }, {} as Record<ExerciseCategory, Exercise[]>);
    }, [allExercises]);

    const plannedExerciseIds = useMemo(() => new Set(plannedExercises.map(e => e.exerciseId)), [plannedExercises]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Selecionar Exercício</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <div className="overflow-y-auto space-y-3">
                    {Object.entries(exercisesByCategory).map(([category, exercises]) => (
                        <div key={category}>
                            <h4 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-2 sticky top-0 bg-light-card dark:bg-dark-card py-1">{category}</h4>
                            {exercises.map(ex => {
                                const isSelected = plannedExerciseIds.has(ex.id);
                                return (
                                <button
                                    key={ex.id}
                                    onClick={() => onSelect(ex.id)}
                                    disabled={isSelected}
                                    className={'w-full text-left p-3 rounded-md flex items-center hover:bg-light-bg dark:hover:bg-dark-bg disabled:opacity-50 disabled:cursor-not-allowed'}
                                >
                                    {isSelected ? 
                                        <CheckCircleIcon className="h-5 w-5 mr-3 flex-shrink-0 text-primary"/> :
                                        <div className={'h-5 w-5 mr-3 flex-shrink-0 rounded-full border-2 border-light-text-secondary dark:border-dark-text-secondary'}></div>
                                    }
                                    <span>{ex.name}</span>
                                </button>
                            )})}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface RoutineFormModalProps {
    onClose: () => void;
    onSave: (data: Omit<Routine, 'id'>) => void;
    routineToEdit: Routine | null;
    allExercises: Exercise[];
    allFolders: Folder[];
}

const RoutineFormModal: React.FC<RoutineFormModalProps> = ({ onClose, onSave, routineToEdit, allExercises, allFolders }) => {
    const [name, setName] = useState(routineToEdit?.name || '');
    const [color, setColor] = useState(routineToEdit?.color || ROUTINE_COLORS[0]);
    const [notes, setNotes] = useState(routineToEdit?.notes || '');
    const [folderId, setFolderId] = useState<string | null>(routineToEdit?.folderId || null);
    const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>(
        JSON.parse(JSON.stringify(routineToEdit?.plannedExercises || []))
    );
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);

    const handleSetChange = (exIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
        setPlannedExercises(prev => {
            const newExercises = [...prev];
            const newSets = [...newExercises[exIndex].sets];
            newSets[setIndex] = { ...newSets[setIndex], [field]: value };
            newExercises[exIndex] = { ...newExercises[exIndex], sets: newSets };
            return newExercises;
        });
    };

    const handleAddSet = (exIndex: number) => {
        setPlannedExercises(prev => {
            const newExercises = [...prev];
            newExercises[exIndex].sets.push({});
            return newExercises;
        });
    };

    const handleDeleteSet = (exIndex: number, setIndex: number) => {
        setPlannedExercises(prev => {
            const newExercises = [...prev];
            newExercises[exIndex].sets.splice(setIndex, 1);
            return newExercises;
        });
    };
    
    const handleAddExerciseToRoutine = (exerciseId: string) => {
        if (!plannedExercises.some(p => p.exerciseId === exerciseId)) {
            setPlannedExercises(prev => [...prev, { exerciseId, sets: [{}], notes: '' }]);
        }
        setIsExercisePickerOpen(false);
    };

    const handleRemoveExercise = (exIndex: number) => {
        setPlannedExercises(prev => prev.filter((_, index) => index !== exIndex));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("O nome da rotina é obrigatório.");
            return;
        }
        const cleanedPlannedExercises = plannedExercises
            .map(pex => ({
                ...pex,
                sets: pex.sets.filter(set => Object.keys(set).length > 0)
            }))
            .filter(pex => pex.sets.length > 0);
        
        onSave({ name, color, notes, folderId, plannedExercises: cleanedPlannedExercises });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-lg max-h-[90vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">{routineToEdit ? 'Editar Rotina' : 'Nova Rotina'}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="overflow-y-auto pr-2 space-y-4">
                        {/* Routine Details */}
                        <div>
                            <label htmlFor="routineName" className="block text-sm font-medium mb-1">Nome da Rotina</label>
                            <input type="text" id="routineName" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Cor</label>
                            <div className="flex flex-wrap gap-2">
                                {ROUTINE_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-primary' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                         <div>
                            <label htmlFor="folderId" className="block text-sm font-medium mb-1">Pasta (Opcional)</label>
                            <select id="folderId" value={folderId || ''} onChange={e => setFolderId(e.target.value || null)} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2">
                                <option value="">Nenhuma</option>
                                {allFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="routineNotes" className="block text-sm font-medium mb-1">Anotações (Opcional)</label>
                            <textarea id="routineNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                        </div>
                        <hr className="border-light-border dark:border-dark-border" />
                        
                        {/* Planned Exercises */}
                        <div className="space-y-3">
                            <h4 className="text-lg font-semibold">Exercícios</h4>
                            {plannedExercises.map((pex, exIndex) => {
                                const exercise = allExercises.find(e => e.id === pex.exerciseId);
                                if (!exercise) return null;
                                const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);
                                
                                return (
                                <div key={pex.exerciseId} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-12 h-12 bg-light-card dark:bg-dark-card rounded-md flex-shrink-0 flex items-center justify-center">
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
                                            <p className="font-semibold">{exercise.name}</p>
                                            <button type="button" onClick={() => setInfoExercise(exercise)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Informações sobre ${exercise.name}`}>
                                                <InfoIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveExercise(exIndex)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                                    </div>
                                    {/* Column Headers */}
                                    <div className="grid grid-cols-12 gap-x-2 items-center text-xs text-center font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 px-1">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-4">
                                            {exercise.measurementType === MeasurementType.COUNT ? 'Reps (Min-Max)' : 'Tempo'}
                                        </div>
                                        <div className="col-span-3">
                                            {exercise.unit !== Unit.NONE ? exercise.unit : 'Valor'}
                                        </div>
                                        <div className="col-span-3">
                                            {scaleOptions ? 'Esforço' : ''}
                                        </div>
                                        <div className="col-span-1" aria-hidden="true" />
                                    </div>
                                    <div className="space-y-2">
                                        {pex.sets.map((set, setIndex) => (
                                            <div key={setIndex} className="grid grid-cols-12 gap-x-2 items-center">
                                                <span className="col-span-1 text-center font-bold">{setIndex + 1}</span>
                                                {exercise.measurementType === MeasurementType.COUNT ? (
                                                    <div className="col-span-4 grid grid-cols-2 gap-x-1">
                                                        <input type="number" placeholder="Min Reps" value={set.repsMin ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'repsMin', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                        <input type="number" placeholder="Max Reps" value={set.repsMax ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'repsMax', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                    </div>
                                                ) : (
                                                    <div className="col-span-4">
                                                        <TimeInput id={`time-${exIndex}-${setIndex}`} valueInSeconds={set.time} onChangeInSeconds={seconds => handleSetChange(exIndex, setIndex, 'time', seconds)} placeholder="MM:SS" className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                    </div>
                                                )}
                                                <div className="col-span-3">
                                                {exercise.unit !== Unit.NONE && <input type="number" placeholder={exercise.unit} value={set.value ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'value', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />}
                                                </div>
                                                <div className="col-span-3">
                                                    {scaleOptions && <select value={set.effort || ''} onChange={e => handleSetChange(exIndex, setIndex, 'effort', e.target.value || undefined)} className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm truncate">
                                                        <option value="">Esforço</option>
                                                        {scaleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>}
                                                </div>
                                                <button type="button" onClick={() => handleDeleteSet(exIndex, setIndex)} className="col-span-1 flex items-center justify-center p-1 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><XIcon className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => handleAddSet(exIndex)} className="w-full text-sm text-primary hover:underline mt-1">Adicionar Série</button>
                                    </div>
                                </div>
                                );
                            })}
                            <button type="button" onClick={() => setIsExercisePickerOpen(true)} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center">
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Adicionar Exercício
                            </button>
                        </div>
                    </div>
                    {/* Footer with buttons */}
                    <div className="pt-4 flex justify-end items-center space-x-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </form>
                {isExercisePickerOpen && (
                    <ExercisePickerModal 
                        onClose={() => setIsExercisePickerOpen(false)}
                        onSelect={handleAddExerciseToRoutine}
                        allExercises={allExercises}
                        plannedExercises={plannedExercises}
                    />
                )}
                {infoExercise && (
                    <ExerciseInfoModal 
                        exercise={infoExercise}
                        onClose={() => setInfoExercise(null)}
                    />
                )}
            </div>
        </div>
    );
};


export default RoutinesScreen;
