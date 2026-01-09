
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { Routine, Folder, Exercise, PlannedExercise, WorkoutSet, MeasurementType, Unit, ExerciseCategory, SetType, CardioMethod, FlexibilityMethod } from '../types';
import { FolderIcon, PlusIcon, PencilIcon, TrashIcon, XIcon, PlayIcon, CopyIcon, SearchIcon, InfoIcon, DumbbellIcon, HeartPulseIcon, StretchIcon, ChevronDownIcon, GripVerticalIcon, ChevronUpIcon } from '../components/Icons';
import { ROUTINE_COLORS, getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, parseTimeToSeconds } from '../utils';
import RoutinesStatsModal from '../components/RoutinesStatsModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';
import CustomSelect from '../components/CustomSelect';
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

// Drag Types
type DragItemType = 'routine' | 'folder';
interface DragItem {
    id: string;
    type: DragItemType;
}
interface DragOverState {
    targetId: string;
    position: 'top' | 'bottom' | 'inside';
}

// Main Component
const RoutinesScreen = () => {
    const { 
        routines, folders, exercises, 
        addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, 
        addFolder, updateFolder, deleteFolder, 
        reorderRoutines, reorderFolders, moveRoutineToFolder, moveFolderToFolder,
        startWorkoutFromRoutine, evaluations 
    } = useApp();

    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);
    
    // State for statistics modal
    const [statsInfo, setStatsInfo] = useState<{ title: string; routines: Routine[] } | null>(null);
    
    const [confirmDeleteRoutineInfo, setConfirmDeleteRoutineInfo] = useState<{ id: string; name: string } | null>(null);
    const [confirmDeleteFolderInfo, setConfirmDeleteFolderInfo] = useState<{ id: string; name: string } | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');

    // Drag and Drop State
    const [dragItem, setDragItem] = useState<DragItem | null>(null);
    const [dragOverState, setDragOverState] = useState<DragOverState | null>(null);
    
    // Ref for Auto-Scrolling
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    const { finalFolders, finalRoutines, isSearching } = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return { finalFolders: folders, finalRoutines: routines, isSearching: false };
        
        const matchingRoutines = routines.filter(r => r.name.toLowerCase().includes(query));
        const matchingFolders = folders.filter(f => f.name.toLowerCase().includes(query));
        const matchingFolderIds = new Set(matchingFolders.map(f => f.id));

        const foldersWithMatchingRoutines = folders.filter(f => 
            matchingRoutines.some(r => r.folderId === f.id)
        );
        const finalFolders = [...new Map([...matchingFolders, ...foldersWithMatchingRoutines].map(f => [f.id, f])).values()];

        const routinesInMatchingFolders = routines.filter(r => r.folderId && matchingFolderIds.has(r.folderId));
        const finalRoutines = [...new Map([...matchingRoutines, ...routinesInMatchingFolders].map(r => [r.id, r])).values()];

        return { finalFolders, finalRoutines, isSearching: true };
    }, [searchQuery, routines, folders]);

    // Data maps for hierarchical display
    const routinesByFolder = useMemo(() => {
        const map = new Map<string, Routine[]>();
        finalRoutines.forEach((routine: Routine) => {
            const folderId = routine.folderId || 'root';
            if (!map.has(folderId)) map.set(folderId, []);
            map.get(folderId)?.push(routine);
        });
        return map;
    }, [finalRoutines]);

    const foldersByParent = useMemo(() => {
        const map = new Map<string, Folder[]>();
        finalFolders.forEach((folder: Folder) => {
            const parentId = folder.parentId || 'root';
            if (!map.has(parentId)) map.set(parentId, []);
            map.get(parentId)?.push(folder);
        });
        return map;
    }, [finalFolders]);

    const rootRoutines = isSearching ? finalRoutines.filter(r => !finalFolders.find(f => f.id === r.folderId)) : (routinesByFolder.get('root') || []);
    const rootFolders = isSearching ? finalFolders : (foldersByParent.get('root') || []);

    const hasOriginalContent = routines.length > 0 || folders.length > 0;
    const hasSearchResults = finalFolders.length > 0 || finalRoutines.length > 0;

    // --- Drag and Drop Handlers ---

    const handleAutoScroll = (clientY: number) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { top, bottom } = container.getBoundingClientRect();
        const threshold = 100; // Distance from edge to trigger scroll
        const speed = 15; // Scroll speed per frame/event

        if (clientY < top + threshold) {
            // Scroll Up
            container.scrollTop -= speed;
        } else if (clientY > bottom - threshold) {
            // Scroll Down
            container.scrollTop += speed;
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string, type: DragItemType) => {
        e.stopPropagation();
        setDragItem({ id, type });
        // Set drag image or data if needed, mostly handled by state
        e.dataTransfer.effectAllowed = 'move';
        // Add a small delay to visual updates to avoid flickering
        setTimeout(() => {
            const el = e.target as HTMLElement;
            el.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const el = e.target as HTMLElement;
        el.style.opacity = '1';
        setDragItem(null);
        setDragOverState(null);
    };

    const handleDragOver = useCallback((e: React.DragEvent, targetId: string, targetType: DragItemType, isTargetFolder: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        // Trigger Auto Scroll
        handleAutoScroll(e.clientY);

        if (!dragItem || dragItem.id === targetId) return;

        // Prevent dragging a folder into itself or its children (simplified check)
        if (dragItem.type === 'folder' && targetType === 'folder' && dragItem.id === targetId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        let position: 'top' | 'bottom' | 'inside';

        if (isTargetFolder) {
            // Folders have an "inside" zone in the middle 50%
            if (y < height * 0.25) position = 'top';
            else if (y > height * 0.75) position = 'bottom';
            else position = 'inside';
        } else {
            // Routines only have top/bottom reordering
            if (y < height * 0.5) position = 'top';
            else position = 'bottom';
        }

        // Prevent dragging routine inside routine (impossible) or folder inside routine (impossible)
        if (position === 'inside' && !isTargetFolder) return;

        setDragOverState({ targetId, position });
    }, [dragItem]);

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only clear if we are leaving the item completely, logic can be tricky with children
        // Usually handled by the next DragOver taking precedence
    };

    const handleDrop = useCallback((e: React.DragEvent, targetId: string, targetType: DragItemType, isTargetFolder: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        if (!dragItem || !dragOverState) {
            setDragItem(null);
            setDragOverState(null);
            return;
        }

        const { id: draggedId, type: draggedType } = dragItem;
        const { position } = dragOverState;

        // Logic for Dropping
        if (draggedType === 'routine') {
            if (position === 'inside' && isTargetFolder) {
                // Move Routine Into Folder
                moveRoutineToFolder(draggedId, targetId);
            } else {
                // Reorder Routine (peer to peer or changing folder context)
                // If dropped relative to a folder (top/bottom), it stays in the folder's parent
                // If dropped relative to a routine, it adopts that routine's folder
                reorderRoutines(draggedId, targetId, position === 'top' ? 'top' : 'bottom');
            }
        } else if (draggedType === 'folder') {
            if (position === 'inside' && isTargetFolder) {
                // Move Folder Into Folder (Nesting)
                if (draggedId !== targetId) {
                    moveFolderToFolder(draggedId, targetId);
                }
            } else {
                // Reorder Folder
                reorderFolders(draggedId, targetId, position === 'top' ? 'top' : 'bottom');
            }
        }

        // Reset Styles
        const el = document.getElementById(targetId); // Assuming we put ID on element
        if(el) el.style.boxShadow = 'none';

        setDragItem(null);
        setDragOverState(null);
    }, [dragItem, dragOverState, moveRoutineToFolder, reorderRoutines, moveFolderToFolder, reorderFolders]);

    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!dragItem) return;
        
        // If dropped in the empty space of the root container, move to root
        if (dragItem.type === 'routine') {
            moveRoutineToFolder(dragItem.id, null);
        } else if (dragItem.type === 'folder') {
            moveFolderToFolder(dragItem.id, null);
        }
        setDragItem(null);
        setDragOverState(null);
    };

    // --- End Drag and Drop Handlers ---

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

    const getAllRoutinesInFolderRecursive = useCallback((folderId: string): Routine[] => {
        const directRoutines = routines.filter(r => r.folderId === folderId);
        const subFolders = folders.filter(f => f.parentId === folderId);
        
        let allRoutines = [...directRoutines];
        subFolders.forEach(sub => {
            allRoutines = [...allRoutines, ...getAllRoutinesInFolderRecursive(sub.id)];
        });
        return allRoutines;
    }, [routines, folders]);

    // Shared props for recursive FolderItems
    const sharedProps = {
        onEditRoutine: (e: React.MouseEvent, r: Routine) => { e.stopPropagation(); setEditingRoutine(r); setIsRoutineModalOpen(true); },
        onDeleteRoutine: (e: React.MouseEvent, r: Routine) => { e.stopPropagation(); setConfirmDeleteRoutineInfo({ id: r.id, name: r.name }); },
        onDuplicateRoutine: (e: React.MouseEvent, rid: string) => { e.stopPropagation(); duplicateRoutine(rid); },
        onStartWorkout: (e: React.MouseEvent, rid: string) => { e.stopPropagation(); startWorkoutFromRoutine(rid); },
        onEditFolder: (e: React.MouseEvent, f: Folder) => { e.stopPropagation(); setEditingFolder(f); setIsFolderModalOpen(true); },
        onDeleteFolder: (e: React.MouseEvent, f: Folder) => { e.stopPropagation(); setConfirmDeleteFolderInfo({ id: f.id, name: f.name }); },
        onShowFolderStats: (e: React.MouseEvent, f: Folder) => { 
            e.stopPropagation(); 
            const allRoutines = getAllRoutinesInFolderRecursive(f.id);
            setStatsInfo({ title: `Estatísticas: ${f.name}`, routines: allRoutines }); 
        },
        onShowRoutineStats: (e: React.MouseEvent, r: Routine) => { e.stopPropagation(); setStatsInfo({ title: `Estatísticas Planejadas: ${r.name}`, routines: [r] }); },
        foldersByParent,
        routinesByFolder,
        // DnD Props
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDrop,
        dragOverState,
        dragItem
    };

    return (
        <div 
            ref={scrollContainerRef}
            className="relative h-full overflow-y-auto" 
            onDragOver={(e) => { 
                e.preventDefault(); 
                handleAutoScroll(e.clientY); 
            }} // Allow dropping on main area and scroll
            onDrop={(e) => {
                // If drop happens here (and not stopped by a child), it means dropped on root empty space
                if(e.target === e.currentTarget) handleRootDrop(e);
            }}
        >
            <div className="p-4 lg:p-6 space-y-4 pb-40 min-h-full">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <input type="text" placeholder="Pesquisar rotinas ou pastas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg py-2 pl-10 pr-4 text-light-text dark:text-dark-text focus:ring-2 focus:ring-primary focus:border-primary transition-colors" />
                    </div>
                    <div className="hidden lg:block ml-4 relative" ref={addOptionsRef}>
                        <button onClick={() => setIsAddOptionsOpen(prev => !prev)} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center">
                            <PlusIcon className="h-5 w-5 mr-2" /> Adicionar
                        </button>
                        {isAddOptionsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-light-card dark:bg-dark-card rounded-lg shadow-xl z-20 border border-light-border dark:border-dark-border p-1">
                                <button onClick={handleOpenAddRoutine} className="w-full text-left flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                                    <div className="h-4 w-4 rounded-sm bg-secondary mr-3 flex-shrink-0"></div> Nova Rotina
                                </button>
                                <button onClick={handleOpenAddFolder} className="w-full text-left flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                                    <FolderIcon className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0" /> Nova Pasta
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {rootFolders.map((folder: Folder) => (
                    <FolderItem 
                        key={folder.id}
                        {...sharedProps}
                        folder={folder} 
                        subFolders={isSearching ? [] : (foldersByParent.get(folder.id) || [])}
                        routines={routinesByFolder.get(folder.id) || []} 
                    />
                ))}
                {rootRoutines.map((routine: Routine) => (
                    <RoutineItem 
                        key={routine.id}
                        routine={routine} 
                        onEdit={(e) => { e.stopPropagation(); setEditingRoutine(routine); setIsRoutineModalOpen(true); }} 
                        onDelete={(e) => { e.stopPropagation(); setConfirmDeleteRoutineInfo({ id: routine.id, name: routine.name }); }} 
                        onDuplicate={(e) => { e.stopPropagation(); duplicateRoutine(routine.id); }} 
                        onStartWorkout={(e) => { e.stopPropagation(); startWorkoutFromRoutine(routine.id); }} 
                        onShowStats={(e) => { e.stopPropagation(); setStatsInfo({ title: `Estatísticas Planejadas: ${routine.name}`, routines: [routine] }); }}
                        // DnD Props
                        handleDragStart={handleDragStart}
                        handleDragEnd={handleDragEnd}
                        handleDragOver={handleDragOver}
                        handleDrop={handleDrop}
                        dragOverState={dragOverState}
                    />
                ))}
                {searchQuery === '' && !hasOriginalContent && <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10"><p>Nenhuma rotina ou pasta criada.</p><p>Clique no botão '+' para começar.</p></div>}
                {searchQuery !== '' && !hasSearchResults && <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10"><p>Nenhum resultado encontrado para "{searchQuery}".</p></div>}
                
                {/* Drop Zone for moving to Root (visible when dragging) */}
                {dragItem && (
                    <div 
                        className="h-20 border-2 border-dashed border-light-border dark:border-dark-border rounded-lg flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary mt-4 transition-colors hover:bg-primary/10 hover:border-primary"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleRootDrop}
                    >
                        Soltar aqui para mover para a Raiz
                    </div>
                )}
            </div>

            <div className="fixed bottom-36 right-6 z-20 lg:hidden" ref={addOptionsRef}>
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
                    <button onClick={() => setIsAddOptionsOpen(prev => !prev)} className="bg-secondary hover:bg-pink-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center">
                        <PlusIcon className={`h-8 w-8 transition-transform duration-200 ${isAddOptionsOpen ? 'rotate-45' : ''}`} />
                    </button>
                </div>
            </div>
            
            {isRoutineModalOpen && (
              <RoutineFormModal 
                onClose={() => setIsRoutineModalOpen(false)} 
                onSave={(data) => { 
                  if(editingRoutine) updateRoutine({ ...data, id: editingRoutine.id } as Routine); 
                  else addRoutine(data as Omit<Routine, 'id'>); 
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
                        if(editingFolder) updateFolder({ ...data, id: editingFolder.id, parentId: editingFolder.parentId } as Folder); 
                        else addFolder({ ...data, parentId: null } as Omit<Folder, 'id'>); 
                        setIsFolderModalOpen(false); 
                    }} 
                    folderToEdit={editingFolder} 
                />
            )}
            {statsInfo && <RoutinesStatsModal title={statsInfo.title} analyzedRoutines={statsInfo.routines} exercises={exercises} evaluations={evaluations} onClose={() => setStatsInfo(null)} />}
            {confirmDeleteRoutineInfo && <ConfirmationModal isOpen={!!confirmDeleteRoutineInfo} onClose={() => setConfirmDeleteRoutineInfo(null)} onConfirm={handleConfirmDeleteRoutine} title="Confirmar Exclusão" message={<>Tem certeza que deseja apagar a rotina <strong>"{confirmDeleteRoutineInfo.name}"</strong>? Esta ação não pode ser desfeita.</>} />}
            {confirmDeleteFolderInfo && <ConfirmationModal isOpen={!!confirmDeleteFolderInfo} onClose={() => setConfirmDeleteFolderInfo(null)} onConfirm={handleConfirmDeleteFolder} title="Confirmar Exclusão" message={<><p>Tem certeza que deseja apagar a pasta <strong>"{confirmDeleteFolderInfo.name}"</strong>?</p><p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">As rotinas dentro dela não serão apagadas, mas movidas para fora da pasta.</p></>} />}
        </div>
    );
};

interface FolderItemProps {
    folder: Folder;
    subFolders: Folder[];
    routines: Routine[];
    onEditRoutine: (e: React.MouseEvent, routine: Routine) => void;
    onDeleteRoutine: (e: React.MouseEvent, routine: Routine) => void;
    onDuplicateRoutine: (e: React.MouseEvent, routineId: string) => void;
    onStartWorkout: (e: React.MouseEvent, routineId: string) => void;
    onEditFolder: (e: React.MouseEvent, f: Folder) => void;
    onDeleteFolder: (e: React.MouseEvent, f: Folder) => void;
    onShowFolderStats: (e: React.MouseEvent, f: Folder) => void;
    onShowRoutineStats: (e: React.MouseEvent, routine: Routine) => void;
    foldersByParent: Map<string, Folder[]>;
    routinesByFolder: Map<string, Routine[]>;
    // DnD
    handleDragStart: (e: React.DragEvent, id: string, type: DragItemType) => void;
    handleDragEnd: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent, targetId: string, type: DragItemType, isFolder: boolean) => void;
    handleDrop: (e: React.DragEvent, targetId: string, type: DragItemType, isFolder: boolean) => void;
    dragOverState: DragOverState | null;
    dragItem: DragItem | null;
}

const FolderItem: React.FC<FolderItemProps> = (props) => {
    const { 
        folder, subFolders, routines, 
        onEditRoutine, onDeleteRoutine, onDuplicateRoutine, onStartWorkout, onEditFolder, onDeleteFolder, onShowFolderStats, onShowRoutineStats, foldersByParent, routinesByFolder,
        handleDragStart, handleDragEnd, handleDragOver, handleDrop, dragOverState, dragItem
    } = props;
    
    const [isExpanded, setIsExpanded] = useState(false);

    const isDragTarget = dragOverState?.targetId === folder.id;
    const dragPosition = isDragTarget ? dragOverState?.position : null;

    const folderStyle = isDragTarget ? 
        (dragPosition === 'inside' ? 'bg-primary/20 dark:bg-primary/30' : 
         dragPosition === 'top' ? 'border-t-2 border-primary' : 
         dragPosition === 'bottom' ? 'border-b-2 border-primary' : '') 
        : '';

    return (
        <div 
            id={folder.id}
            draggable
            onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, folder.id, 'folder', true)}
            onDrop={(e) => handleDrop(e, folder.id, 'folder', true)}
            className={`bg-light-card dark:bg-dark-card rounded-lg border-2 border-transparent transition-all duration-200 mb-2 ${folderStyle}`}
        >
            <div className="p-3 transition-colors">
                {/* Reordered Icons: Trash -> Edit -> Info -> Grip */}
                <div className="flex items-center justify-end space-x-2 mb-2">
                    <button onClick={(e) => onDeleteFolder(e, folder)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                    <button onClick={(e) => onEditFolder(e, folder)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={(e) => onShowFolderStats(e, folder)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500"><InfoIcon className="h-5 w-5" /></button>
                    <div className="cursor-grab p-2 active:cursor-grabbing text-light-text-secondary"><GripVerticalIcon className="h-5 w-5" /></div>
                </div>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center min-w-0">
                        <FolderIcon className="h-6 w-6 text-yellow-400 mr-3 flex-shrink-0" />
                        <h3 className="font-bold text-lg truncate">{folder.name}</h3>
                        <span className="ml-2 text-xs bg-light-bg dark:bg-dark-bg px-2 py-0.5 rounded-full text-light-text-secondary">{routines.length + subFolders.length}</span>
                    </div>
                    <ChevronDownIcon className={`h-6 w-6 text-light-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="p-2 pt-0 pl-4 space-y-2 border-t border-light-border dark:border-dark-border">
                    {/* Render Subfolders Recursively */}
                    {subFolders.map(subFolder => (
                        <FolderItem 
                            key={subFolder.id}
                            {...props} 
                            folder={subFolder}
                            subFolders={foldersByParent.get(subFolder.id) || []}
                            routines={routinesByFolder.get(subFolder.id) || []}
                        />
                    ))}

                    {/* Render Routines */}
                    {routines.map(routine => (
                        <RoutineItem 
                            key={routine.id} 
                            routine={routine} 
                            onEdit={(e) => onEditRoutine(e, routine)} 
                            onDelete={(e) => onDeleteRoutine(e, routine)} 
                            onDuplicate={(e) => onDuplicateRoutine(e, routine.id)} 
                            onStartWorkout={(e) => onStartWorkout(e, routine.id)} 
                            onShowStats={(e) => onShowRoutineStats(e, routine)}
                            // DnD
                            handleDragStart={handleDragStart}
                            handleDragEnd={handleDragEnd}
                            handleDragOver={handleDragOver}
                            handleDrop={handleDrop}
                            dragOverState={dragOverState}
                        />
                    ))}
                    {routines.length === 0 && subFolders.length === 0 && (
                        <div className="text-center py-4 text-sm text-light-text-secondary italic">
                            Pasta vazia. Arraste itens para cá.
                        </div>
                    )}
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
    onShowStats: (e: React.MouseEvent) => void;
    // DnD
    handleDragStart: (e: React.DragEvent, id: string, type: DragItemType) => void;
    handleDragEnd: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent, targetId: string, type: DragItemType, isFolder: boolean) => void;
    handleDrop: (e: React.DragEvent, targetId: string, type: DragItemType, isFolder: boolean) => void;
    dragOverState: DragOverState | null;
}

const RoutineItem: React.FC<RoutineItemProps> = ({ 
    routine, onEdit, onDelete, onDuplicate, onStartWorkout, onShowStats, 
    handleDragStart, handleDragEnd, handleDragOver, handleDrop, dragOverState 
}) => {
    const isDragTarget = dragOverState?.targetId === routine.id;
    const dragPosition = isDragTarget ? dragOverState?.position : null;

    const itemStyle = isDragTarget ? 
        (dragPosition === 'top' ? 'border-t-4 border-primary' : 
         dragPosition === 'bottom' ? 'border-b-4 border-primary' : '') 
        : '';

    return (
        <div 
            id={routine.id}
            draggable
            onDragStart={(e) => handleDragStart(e, routine.id, 'routine')}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, routine.id, 'routine', false)}
            onDrop={(e) => handleDrop(e, routine.id, 'routine', false)}
            className={`bg-light-card dark:bg-dark-card rounded-lg shadow-sm border-l-4 p-4 transition-all duration-200 mb-2 ${itemStyle}`} 
            style={{ borderLeftColor: routine.color }}
        >
            {/* Reordered Icons: Trash -> Edit -> Copy -> Info -> Grip */}
            <div className="flex justify-end items-center space-x-1 mb-2">
                <button onClick={onDelete} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                <button onClick={onEdit} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text"><PencilIcon className="h-5 w-5" /></button>
                <button onClick={onDuplicate} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:text-primary"><CopyIcon className="h-5 w-5" /></button>
                <button onClick={onShowStats} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Estatísticas de ${routine.name}`}><InfoIcon className="h-5 w-5" /></button>
                <div className="cursor-grab p-2 active:cursor-grabbing text-light-text-secondary"><GripVerticalIcon className="h-5 w-5" /></div>
            </div>
            
            <div className="flex items-center min-w-0">
                <div className="min-w-0 flex-grow">
                    <h4 className="font-bold text-lg truncate leading-tight">{routine.name}</h4>
                    <p className="text-sm text-light-text-secondary truncate">{routine.plannedExercises.length} exercícios</p>
                </div>
            </div>
            <button onClick={onStartWorkout} className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center transition-colors"><PlayIcon className="h-5 w-5 mr-2" /> Iniciar Treino</button>
        </div>
    );
};

// --- Form Modals ---
const RoutineFormModal = ({ onClose, onSave, routineToEdit, allExercises, allFolders }: { onClose: () => void; onSave: (data: Partial<Routine>) => void; routineToEdit: Routine | null; allExercises: Exercise[]; allFolders: Folder[]; }) => {
    const [name, setName] = useState(routineToEdit?.name || '');
    const [color, setColor] = useState(routineToEdit?.color || ROUTINE_COLORS[0]);
    const [folderId, setFolderId] = useState<string | null>(routineToEdit?.folderId || null);
    
    // We add a tempId to plannedExercises for stable rendering keys during form editing
    const [plannedExercises, setPlannedExercises] = useState<(PlannedExercise & { internalId: string })[]>(() => {
        if (routineToEdit?.plannedExercises) {
            return routineToEdit.plannedExercises.map((pe, idx) => ({ ...pe, internalId: `pe-${Date.now()}-${idx}` }));
        }
        return [];
    });
    
    const [notes, setNotes] = useState(routineToEdit?.notes || '');
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);

    const folderOptions = [{ value: 'none', label: 'Nenhuma Pasta' }, ...allFolders.map(f => ({ value: f.id, label: f.name }))];

    // Method Options
    const setTypeOptions = Object.values(SetType).map(t => ({ value: t, label: t }));
    const cardioOptions = Object.values(CardioMethod).map(m => ({ value: m, label: m }));
    const flexOptions = Object.values(FlexibilityMethod).map(m => ({ value: m, label: m }));

    const handleSubmit = (e?: React.BaseSyntheticEvent) => {
        if (e) e.preventDefault();
        
        if (!name.trim()) {
            alert("O nome da rotina é obrigatório.");
            return;
        }
        if (plannedExercises.length === 0) {
            alert("Adicione ao menos um exercício à rotina.");
            return;
        }

        // Remove the internalId used for rendering before saving
        const cleanedPlannedExercises = plannedExercises.map(({ internalId, ...rest }) => rest);

        onSave({ 
            name, 
            color, 
            folderId: folderId === 'none' ? null : folderId, 
            plannedExercises: cleanedPlannedExercises, 
            notes: notes.trim() 
        });
    };

    const handleAddPlannedExercise = (ex: Exercise) => {
        setPlannedExercises([...plannedExercises, { 
            exerciseId: ex.id, 
            sets: [{}], 
            notes: '', 
            internalId: `pe-${Date.now()}` 
        }]);
        setIsExercisePickerOpen(false);
    };

    const handleDuplicatePlannedExercise = (index: number) => {
        const exerciseToDuplicate = plannedExercises[index];
        const newExercise = {
            ...JSON.parse(JSON.stringify(exerciseToDuplicate)),
            internalId: `pe-${Date.now()}-dup`
        };
        const newPlanned = [...plannedExercises];
        newPlanned.splice(index + 1, 0, newExercise);
        setPlannedExercises(newPlanned);
    };

    const handleUpdatePlannedExercise = (index: number, updates: Partial<PlannedExercise>) => {
        const newPlanned = [...plannedExercises];
        newPlanned[index] = { ...newPlanned[index], ...updates };
        setPlannedExercises(newPlanned);
    };

    const handleUpdateSet = (exIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => {
        const newPlanned = [...plannedExercises];
        const newSets = [...newPlanned[exIndex].sets];
        newSets[setIndex] = { ...newSets[setIndex], ...updates };
        newPlanned[exIndex] = { ...newPlanned[exIndex], sets: newSets };
        setPlannedExercises(newPlanned);
    };

    const handleMoveExerciseUp = (index: number) => {
        if (index === 0) return;
        const newExercises = [...plannedExercises];
        [newExercises[index - 1], newExercises[index]] = [newExercises[index], newExercises[index - 1]];
        setPlannedExercises(newExercises);
    };

    const handleMoveExerciseDown = (index: number) => {
        if (index === plannedExercises.length - 1) return;
        const newExercises = [...plannedExercises];
        [newExercises[index + 1], newExercises[index]] = [newExercises[index], newExercises[index + 1]];
        setPlannedExercises(newExercises);
    };

    return (
        <div className="fixed inset-0 bg-light-bg dark:bg-dark-bg flex flex-col z-50 overflow-hidden">
            <div className="bg-light-card dark:bg-dark-card flex-grow flex flex-col h-full shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-light-border dark:border-dark-border safe-top-padding">
                    <h3 className="text-xl font-bold">{routineToEdit ? 'Editar Rotina' : 'Nova Rotina'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nome da Rotina</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium mb-1">Pasta</label>
                             <CustomSelect options={folderOptions} value={folderId || 'none'} onChange={v => setFolderId(v === 'none' ? null : v || null)} allowDeselect={false} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Cor da Rotina</label>
                        <div className="flex flex-wrap gap-2">
                            {ROUTINE_COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-light-text dark:border-dark-text scale-110' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c }} />)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Anotações da Rotina</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" placeholder="Dicas gerais para este treino..." />
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold">Exercícios</h4>
                            <button type="button" onClick={() => setIsExercisePickerOpen(true)} className="bg-primary text-white py-1 px-3 rounded-md text-sm font-bold flex items-center"><PlusIcon className="h-4 w-4 mr-1" /> Adicionar</button>
                        </div>
                        {plannedExercises.map((pe, exIndex) => {
                            const ex = allExercises.find(e => e.id === pe.exerciseId);
                            if (!ex) return null;
                            const scaleOptions = getScaleOptions(ex.perceivedExertionScale);
                            return (
                                <div key={pe.internalId} className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            {ex.category === ExerciseCategory.RESISTED && (
                                                <MethodPicker
                                                    value={pe.method || SetType.NORMAL}
                                                    onChange={(val) => handleUpdatePlannedExercise(exIndex, { method: val })}
                                                    options={setTypeOptions}
                                                    title="Selecionar Método"
                                                    className={`text-sm font-bold ${
                                                        pe.method === SetType.WARM_UP ? 'text-yellow-600 dark:text-yellow-400' :
                                                        (pe.method && pe.method !== SetType.NORMAL) ? 'text-secondary' : 
                                                        'text-light-text dark:text-dark-text'
                                                    }`}
                                                />
                                            )}
                                            {ex.category === ExerciseCategory.CARDIO && (
                                                <MethodPicker
                                                    value={pe.method || undefined}
                                                    onChange={(val) => handleUpdatePlannedExercise(exIndex, { method: val })}
                                                    options={cardioOptions}
                                                    title="Selecionar Método Cardio"
                                                    placeholder="Selecionar Método"
                                                    className="text-sm font-bold text-light-text dark:text-dark-text"
                                                />
                                            )}
                                            {ex.category === ExerciseCategory.FLEXIBILITY && (
                                                <MethodPicker
                                                    value={pe.method || undefined}
                                                    onChange={(val) => handleUpdatePlannedExercise(exIndex, { method: val })}
                                                    options={flexOptions}
                                                    title="Selecionar Método Flexibilidade"
                                                    placeholder="Selecionar Método"
                                                    className="text-sm font-bold text-light-text dark:text-dark-text"
                                                />
                                            )}
                                            {/* Icons Row */}
                                            <div className="flex items-center justify-end gap-1 ml-auto">
                                                <button type="button" onClick={() => setPlannedExercises(plannedExercises.filter((_, i) => i !== exIndex))} className="p-2 text-light-text-secondary hover:text-red-500" aria-label="Remover">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                                <button type="button" onClick={() => handleDuplicatePlannedExercise(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Duplicar">
                                                    <CopyIcon className="h-5 w-5" />
                                                </button>
                                                <button type="button" onClick={() => setInfoExercise(ex)} className="p-2 text-light-text-secondary hover:text-blue-500" aria-label="Informações">
                                                    <InfoIcon className="h-5 w-5" />
                                                </button>
                                                <div className="flex gap-1">
                                                    {exIndex > 0 && (
                                                        <button type="button" onClick={() => handleMoveExerciseUp(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Mover para cima">
                                                            <ChevronUpIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                    {exIndex < plannedExercises.length - 1 && (
                                                        <button type="button" onClick={() => handleMoveExerciseDown(exIndex)} className="p-2 text-light-text-secondary hover:text-primary" aria-label="Mover para baixo">
                                                            <ChevronDownIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Name Row */}
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg">{exIndex + 1}. {ex.name}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <input 
                                            type="text" 
                                            value={pe.notes || ''} 
                                            onChange={e => handleUpdatePlannedExercise(exIndex, { notes: e.target.value })} 
                                            placeholder="Anotações para este exercício..." 
                                            className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm" 
                                        />
                                        {(ex.includeBarbellWeight || ex.isCounterweight) && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs font-bold whitespace-nowrap text-light-text-secondary dark:text-dark-text-secondary">
                                                    {ex.isCounterweight ? 'Peso Contrapeso:' : 'Peso Barra:'}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    inputMode="decimal"
                                                    value={pe.barbellWeight || ''} 
                                                    onChange={e => handleUpdatePlannedExercise(exIndex, { barbellWeight: Number(e.target.value) })} 
                                                    placeholder="kg" 
                                                    className="w-20 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1.5 text-sm" 
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {pe.sets.map((set, setIndex) => (
                                            <div key={setIndex} className="flex items-center gap-1 bg-light-card dark:bg-dark-card p-1.5 rounded-md overflow-x-auto no-scrollbar">
                                                <span className="text-[10px] font-bold shrink-0 w-6">S{setIndex + 1}</span>
                                                
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    {ex.measurementType === MeasurementType.COUNT ? (
                                                        <div className="flex items-center gap-0.5">
                                                            <input 
                                                                type="number" 
                                                                inputMode="numeric"
                                                                value={set.repsMin || ''} 
                                                                onChange={e => handleUpdateSet(exIndex, setIndex, { repsMin: Number(e.target.value) })} 
                                                                placeholder="min" 
                                                                className="w-10 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-xs" 
                                                            />
                                                            <span className="text-[10px]">-</span>
                                                            <input 
                                                                type="number" 
                                                                inputMode="numeric"
                                                                value={set.repsMax || ''} 
                                                                onChange={e => handleUpdateSet(exIndex, setIndex, { repsMax: Number(e.target.value) })} 
                                                                placeholder="max" 
                                                                className="w-10 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-xs" 
                                                            />
                                                        </div>
                                                    ) : (
                                                        <TimeInput 
                                                            id={`time-${exIndex}-${setIndex}`} 
                                                            valueInSeconds={set.time} 
                                                            onChangeInSeconds={s => handleUpdateSet(exIndex, setIndex, { time: s })} 
                                                            placeholder="00:00" 
                                                            className="w-14 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-xs" 
                                                        />
                                                    )}
                                                </div>

                                                {ex.unit !== Unit.NONE && (
                                                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                                        <input 
                                                            type="number" 
                                                            inputMode="decimal"
                                                            value={set.value || ''} 
                                                            onChange={e => handleUpdateSet(exIndex, setIndex, { value: Number(e.target.value) })} 
                                                            placeholder="val"
                                                            className="w-12 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-xs" 
                                                        />
                                                        <span className="text-[10px] font-medium opacity-70">{ex.unit === Unit.KG ? 'kg' : ex.unit === Unit.SPEED ? 'kmh' : 'u'}</span>
                                                    </div>
                                                )}

                                                {scaleOptions && (
                                                    <div className="w-14 h-8 shrink-0 ml-1">
                                                        <EffortPicker options={scaleOptions} value={set.effort} onChange={v => handleUpdateSet(exIndex, setIndex, { effort: v })} placeholder="Esf." />
                                                    </div>
                                                )}

                                                <button 
                                                    type="button" 
                                                    onClick={() => { const ns = [...pe.sets]; ns.splice(setIndex, 1); handleUpdatePlannedExercise(exIndex, { sets: ns }); }} 
                                                    className="text-light-text-secondary hover:text-red-500 ml-auto p-1"
                                                >
                                                    <XIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => handleUpdatePlannedExercise(exIndex, { sets: [...pe.sets, {}] })} className="text-[11px] text-primary font-bold hover:underline py-1 px-2">+ Adicionar Série</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </form>
                <div className="p-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3 safe-bottom-padding bg-light-card dark:bg-dark-card">
                    <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-700 py-2 px-6 rounded-md font-bold">Cancelar</button>
                    <button type="button" onClick={() => handleSubmit()} className="bg-secondary text-white py-2 px-6 rounded-md font-bold">Salvar Rotina</button>
                </div>
            </div>
            {isExercisePickerOpen && <ExercisePickerModal onClose={() => setIsExercisePickerOpen(false)} onSelect={handleAddPlannedExercise} allExercises={allExercises} />}
            {infoExercise && <ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />}
        </div>
    );
};

const FolderFormModal = ({ onClose, onSave, folderToEdit }: { onClose: () => void; onSave: (data: Partial<Folder>) => void; folderToEdit: Folder | null; }) => {
    const [name, setName] = useState(folderToEdit?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm shadow-xl text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{folderToEdit ? 'Editar Pasta' : 'Nova Pasta'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-1">Nome da Pasta</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-700 font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ExercisePickerModal = ({ onClose, onSelect, allExercises }: { onClose: () => void; onSelect: (exercise: Exercise) => void; allExercises: Exercise[]; }) => {
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
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl text-light-text dark:text-dark-text">
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
                                            onClick={() => onSelect(ex)} 
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

export default RoutinesScreen;