
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Routine, Folder, Exercise, ExerciseCategory, PlannedExercise, WorkoutSet, MeasurementType, Unit, PerceivedExertionScale } from '../types';
import { FolderIcon, PlusIcon, PencilIcon, TrashIcon, XIcon, ChevronRightIcon, PlayIcon, CheckCircleIcon, CopyIcon, SearchIcon, InfoIcon, DumbbellIcon, GripVerticalIcon, ChevronDownIcon } from '../components/Icons';
import { ROUTINE_COLORS, getScaleOptions } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatSecondsToMMSS, parseTimeToSeconds, vibrate } from '../utils';
import FolderStatsModal from '../components/FolderStatsModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';
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

// Ghost Item for Touch Dragging
interface GhostElementProps {
  content: React.ReactNode;
  x: number;
  y: number;
}
const GhostItem: React.FC<GhostElementProps> = ({ content, x, y }) => {
    if (!content) return null;
    return (
        <div
            className="fixed p-2 rounded-lg z-[9999] pointer-events-none opacity-80 shadow-2xl bg-light-card dark:bg-dark-card"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                minWidth: '250px',
            }}
        >
            {content}
        </div>
    );
};

interface DraggingItem { type: 'routine' | 'folder'; id: string; source: { folderId: string | null; }; }

// Main Component
const RoutinesScreen = () => {
    const { routines, folders, exercises, addRoutine, updateRoutine, deleteRoutine, duplicateRoutine, addFolder, updateFolder, deleteFolder, moveRoutineToFolder, startWorkoutFromRoutine, reorderRoutines, reorderFolders, evaluations } = useApp();

    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);
    const [folderForStats, setFolderForStats] = useState<Folder | null>(null);
    
    const [confirmDeleteRoutineInfo, setConfirmDeleteRoutineInfo] = useState<{ id: string; name: string } | null>(null);
    const [confirmDeleteFolderInfo, setConfirmDeleteFolderInfo] = useState<{ id: string; name: string } | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');

    const addOptionsRef = useRef<HTMLDivElement>(null);

    // Drag and Drop State
    const [draggingItem, setDraggingItem] = useState<DraggingItem | null>(null);
    const [dropTarget, setDropTarget] = useState<{ type: 'folder' | 'routine' | 'root'; id: string | null } | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ targetId: string; type: 'routine' | 'folder'; position: 'top' | 'bottom' } | null>(null);

    // Touch Drag State
    const [ghostElement, setGhostElement] = useState<GhostElementProps | null>(null);
    const dragTimeoutRef = useRef<number | null>(null);
    const dragStartInfo = useRef<{ x: number, y: number, item: DraggingItem, element: HTMLElement } | null>(null);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    
    // Auto-scroll refs and logic
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
    const lastClientY = useRef<number>(0);

    const stopScrolling = () => {
        if (scrollIntervalRef.current) {
            cancelAnimationFrame(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
        scrollDirectionRef.current = null;
    };

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
    
    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

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
        if (!query) return { finalFolders: folders, finalRoutines: routines };
        
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
            if (!map.has(folderId)) map.set(folderId, []);
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

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, item: DraggingItem) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
        setDraggingItem(item);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingItem) return;

        lastClientY.current = e.clientY;
        if (scrollContainerRef.current) {
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
        }
        
        const targetElement = (e.target as HTMLElement).closest('[data-drag-id]');
        const targetFolderElement = (e.target as HTMLElement).closest('[data-folder-id]');
        
        if (targetElement) {
            const targetId = targetElement.getAttribute('data-drag-id')!;
            const targetType = targetElement.getAttribute('data-drag-type')! as 'routine' | 'folder';
            const targetRect = targetElement.getBoundingClientRect();
            const midpointY = targetRect.top + targetRect.height / 2;
            const position = e.clientY < midpointY ? 'top' : 'bottom';
            setDropIndicator({ type: targetType, targetId, position });
            setDropTarget(null);
        } else if (targetFolderElement && draggingItem.type === 'routine') {
            const folderId = targetFolderElement.getAttribute('data-folder-id')!;
            setDropTarget({ type: 'folder', id: folderId });
            setDropIndicator(null);
        } else {
             setDropTarget({ type: 'root', id: null });
             setDropIndicator(null);
        }
    };

    const handleDragEnd = () => {
        stopScrolling();
        setDraggingItem(null);
        setDropTarget(null);
        setDropIndicator(null);
    };
    
    const handleItemDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggingItem && dropIndicator) {
            const { type: draggedType, id: draggedId } = draggingItem;
            const { type: targetType, targetId, position } = dropIndicator;
            if (draggedType === targetType && draggedId !== targetId) {
                if (draggedType === 'routine') reorderRoutines(draggedId, targetId, position);
                else if (draggedType === 'folder') reorderFolders(draggedId, targetId, position);
            }
        }
        handleDragEnd();
    };

    const handleFolderDrop = (e: React.DragEvent, target: {type: 'folder' | 'root', id: string | null}) => {
        e.preventDefault();
        if (draggingItem?.type === 'routine' && draggingItem.source.folderId !== target.id) {
            moveRoutineToFolder(draggingItem.id, target.id);
        }
        handleDragEnd();
    };

    const handleTouchStart = (e: React.TouchEvent, item: DraggingItem, element: HTMLElement) => {
        if (e.touches.length > 1) return;
        dragStartInfo.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, item, element };
        if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = window.setTimeout(() => {
            if (!dragStartInfo.current) return;
            setDraggingItem(item);
            const clone = dragStartInfo.current.element.cloneNode(true) as HTMLElement;
            clone.style.width = `${dragStartInfo.current.element.offsetWidth}px`;
            setGhostElement({ content: <div dangerouslySetInnerHTML={{ __html: clone.outerHTML }} />, x: dragStartInfo.current.x, y: dragStartInfo.current.y });
            vibrate(50);
            dragTimeoutRef.current = null;
        }, 300);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!dragStartInfo.current) return;
        if (!draggingItem) {
             if (dragTimeoutRef.current) {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - dragStartInfo.current.x);
                const dy = Math.abs(touch.clientY - dragStartInfo.current.y);
                if (dx > 10 || dy > 10) {
                    clearTimeout(dragTimeoutRef.current);
                    dragTimeoutRef.current = null;
                    dragStartInfo.current = null;
                }
            }
            return;
        }
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        lastClientY.current = touch.clientY;
        setGhostElement(g => g ? { ...g, x: touch.clientX, y: touch.clientY } : null);
        const ghostDOMElement = document.querySelector('.fixed.z-\\[9999\\]');
        if (ghostDOMElement) (ghostDOMElement as HTMLElement).style.display = 'none';
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (ghostDOMElement) (ghostDOMElement as HTMLElement).style.display = 'block';
        const dropTargetItem = targetElement?.closest('[data-drag-id]');
        const dropTargetFolder = targetElement?.closest('[data-folder-id]');
        if (dropTargetItem) {
            const targetId = dropTargetItem.getAttribute('data-drag-id')!;
            const targetType = dropTargetItem.getAttribute('data-drag-type')! as 'routine' | 'folder';
            const targetRect = dropTargetItem.getBoundingClientRect();
            const midpointY = targetRect.top + targetRect.height / 2;
            const position = touch.clientY < midpointY ? 'top' : 'bottom';
            setDropIndicator({ type: targetType, targetId, position });
            setDropTarget(null);
        } else if (dropTargetFolder && draggingItem.type === 'routine') {
            const folderId = dropTargetFolder.getAttribute('data-folder-id')!;
            setDropTarget({ type: 'folder', id: folderId });
            setDropIndicator(null);
        } else {
            setDropTarget({ type: 'root', id: null });
            setDropIndicator(null);
        }
    };

    const handleTouchEnd = () => {
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }
        if (draggingItem && dropIndicator) {
            const { type: draggedType, id: draggedId } = draggingItem;
            const { type: targetType, targetId, position } = dropIndicator;
            if (draggedType === targetType && draggedId !== targetId) {
                if (draggedType === 'routine') reorderRoutines(draggedId, targetId, position);
                else if (draggedType === 'folder') reorderFolders(draggedId, targetId, position);
            }
        } else if (draggingItem?.type === 'routine' && dropTarget) {
            if (dropTarget.type === 'folder') moveRoutineToFolder(draggingItem.id, dropTarget.id);
            else if (dropTarget.type === 'root') moveRoutineToFolder(draggingItem.id, null);
        }
        stopScrolling();
        setDraggingItem(null);
        setDropTarget(null);
        setDropIndicator(null);
        setGhostElement(null);
        dragStartInfo.current = null;
    };

    return (
        <div ref={scrollContainerRef} className="relative h-full overflow-y-auto" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd} onDragOver={handleDragOver} onDragLeave={stopScrolling} onDrop={(e) => handleFolderDrop(e, {type: 'root', id: null})}>
            <div className="p-4 lg:p-6 space-y-4 pb-40">
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

                {finalFolders.map((folder: Folder) => (
                    <React.Fragment key={folder.id}>
                        {dropIndicator?.targetId === folder.id && dropIndicator.type === 'folder' && dropIndicator.position === 'top' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                        <FolderItem folder={folder} routines={routinesByFolder.get(folder.id) || []} onEditRoutine={(e, routine) => { e.stopPropagation(); setEditingRoutine(routine); setIsRoutineModalOpen(true); }} onDeleteRoutine={(e, routine) => { e.stopPropagation(); setConfirmDeleteRoutineInfo({ id: routine.id, name: routine.name }); }} onDuplicateRoutine={(e, routineId) => { e.stopPropagation(); duplicateRoutine(routineId); }} onStartWorkout={(e, routineId) => { e.stopPropagation(); startWorkoutFromRoutine(routineId); }} onEditFolder={(e) => { e.stopPropagation(); setEditingFolder(folder); setIsFolderModalOpen(true); }} onDeleteFolder={(e) => { e.stopPropagation(); setConfirmDeleteFolderInfo({ id: folder.id, name: folder.name }); }} onShowStats={(e) => { e.stopPropagation(); setFolderForStats(folder); }} isDropTarget={dropTarget?.type === 'folder' && dropTarget.id === folder.id} draggingItem={draggingItem} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onTouchStart={handleTouchStart} onFolderDrop={handleFolderDrop} onItemDrop={handleItemDrop} isTouchDevice={isTouchDevice} dropIndicator={dropIndicator} />
                        {dropIndicator?.targetId === folder.id && dropIndicator.type === 'folder' && dropIndicator.position === 'bottom' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                    </React.Fragment>
                ))}
                {rootRoutines.map((routine: Routine) => (
                    <React.Fragment key={routine.id}>
                        {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'top' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                        <RoutineItem routine={routine} onEdit={(e) => { e.stopPropagation(); setEditingRoutine(routine); setIsRoutineModalOpen(true); }} onDelete={(e) => { e.stopPropagation(); setConfirmDeleteRoutineInfo({ id: routine.id, name: routine.name }); }} onDuplicate={(e) => { e.stopPropagation(); duplicateRoutine(routine.id); }} onStartWorkout={(e) => { e.stopPropagation(); startWorkoutFromRoutine(routine.id); }} onDragStart={(e) => handleDragStart(e, {type: 'routine', id: routine.id, source: { folderId: routine.folderId }})} onDragEnd={handleDragEnd} onDrop={handleItemDrop} onTouchStart={handleTouchStart} isDragging={draggingItem?.type === 'routine' && draggingItem.id === routine.id} isTouchDevice={isTouchDevice} dropIndicator={dropIndicator} />
                        {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'bottom' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                    </React.Fragment>
                ))}
                {searchQuery === '' && !hasOriginalContent && <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10"><p>Nenhuma rotina ou pasta criada.</p><p>Clique no botão '+' para começar.</p></div>}
                {searchQuery !== '' && !hasSearchResults && <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10"><p>Nenhum resultado encontrado para "{searchQuery}".</p></div>}
            </div>

            {ghostElement && <GhostItem {...ghostElement} />}

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
            
            {isRoutineModalOpen && <RoutineFormModal onClose={() => setIsRoutineModalOpen(false)} onSave={(data) => { if(editingRoutine) updateRoutine({ ...data, id: editingRoutine.id }); else addRoutine(data as Omit<Routine, 'id'>); setIsRoutineModalOpen(false); }} routineToEdit={editingRoutine} allExercises={exercises} allFolders={folders} />}
            {isFolderModalOpen && <FolderFormModal onClose={() => setIsFolderModalOpen(false)} onSave={(data) => { if(editingFolder) updateFolder({ ...data, id: editingFolder.id, parentId: null }); else addFolder({ ...data, parentId: null }); setIsFolderModalOpen(false); }} folderToEdit={editingFolder} />}
            {folderForStats && <FolderStatsModal folder={folderForStats} routines={routines} exercises={exercises} evaluations={evaluations} onClose={() => setFolderForStats(null)} />}
            {confirmDeleteRoutineInfo && <ConfirmationModal isOpen={!!confirmDeleteRoutineInfo} onClose={() => setConfirmDeleteRoutineInfo(null)} onConfirm={handleConfirmDeleteRoutine} title="Confirmar Exclusão" message={<>Tem certeza que deseja apagar a rotina <strong>"{confirmDeleteRoutineInfo.name}"</strong>? Esta ação não pode ser desfeita.</>} />}
            {confirmDeleteFolderInfo && <ConfirmationModal isOpen={!!confirmDeleteFolderInfo} onClose={() => setConfirmDeleteFolderInfo(null)} onConfirm={handleConfirmDeleteFolder} title="Confirmar Exclusão" message={<><p>Tem certeza que deseja apagar a pasta <strong>"{confirmDeleteFolderInfo.name}"</strong>?</p><p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">As rotinas dentro dela não serão apagadas, mas movidas para fora da pasta.</p></>} />}
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
    draggingItem: DraggingItem | null;
    onDragStart: (e: React.DragEvent, item: DraggingItem) => void;
    onDragEnd: () => void;
    onTouchStart: (e: React.TouchEvent, item: DraggingItem, element: HTMLElement) => void;
    onFolderDrop: (e: React.DragEvent, target: {type: 'folder' | 'root', id: string | null}) => void;
    onItemDrop: (e: React.DragEvent) => void;
    isTouchDevice: boolean;
    dropIndicator: { targetId: string; type: string; position: 'top' | 'bottom' } | null;
}

const FolderItem = ({ folder, routines, onEditRoutine, onDeleteRoutine, onDuplicateRoutine, onStartWorkout, onEditFolder, onDeleteFolder, onShowStats, isDropTarget, draggingItem, onDragStart, onDragEnd, onTouchStart, onFolderDrop, onItemDrop, isTouchDevice, dropIndicator }: FolderItemProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const folderRef = useRef<HTMLDivElement>(null);
    const folderHeaderRef = useRef<HTMLDivElement>(null);
    const isDraggingThis = draggingItem?.type === 'folder' && draggingItem.id === folder.id;

    return (
        <div ref={folderRef} data-folder-id={folder.id} className={`bg-light-card dark:bg-dark-card rounded-lg border-2 transition-colors ${isDraggingThis ? 'opacity-40' : ''} ${isDropTarget && draggingItem?.type === 'routine' ? 'border-primary bg-primary/20' : 'border-transparent'}`} onDrop={(e) => onFolderDrop(e, {type: 'folder', id: folder.id})}>
            <div ref={folderHeaderRef} data-drag-id={folder.id} data-drag-type="folder" className={`p-3 transition-colors ${isDropTarget && draggingItem?.type === 'folder' ? 'bg-primary/10' : ''}`} onDrop={onItemDrop}>
                <div className="flex items-center justify-end space-x-2 mb-2">
                    <button onClick={onShowStats} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500"><InfoIcon className="h-5 w-5" /></button>
                    <button onClick={onEditFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={onDeleteFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                </div>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center min-w-0">
                        <div draggable={!isTouchDevice} onDragStart={(e) => onDragStart(e, {type: 'folder', id: folder.id, source: { folderId: null }})} onDragEnd={onDragEnd} onTouchStart={(e) => onTouchStart(e, {type: 'folder', id: folder.id, source: { folderId: null }}, folderHeaderRef.current!)} className="p-2 -ml-2 cursor-grab"><GripVerticalIcon className="h-5 w-5 text-light-text-secondary" /></div>
                        <FolderIcon className="h-6 w-6 text-yellow-400 mr-3 flex-shrink-0" />
                        <h3 className="font-bold text-lg truncate">{folder.name}</h3>
                        <span className="ml-2 text-xs bg-light-bg dark:bg-dark-bg px-2 py-0.5 rounded-full text-light-text-secondary">{routines.length}</span>
                    </div>
                    <ChevronDownIcon className={`h-6 w-6 text-light-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="p-2 pt-0 space-y-2 border-t border-light-border dark:border-dark-border">
                    {routines.map(routine => (
                        <React.Fragment key={routine.id}>
                            {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'top' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                            {/* Fixed: changed 'handleDragEnd' to 'onDragEnd' */}
                            <RoutineItem routine={routine} onEdit={(e) => onEditRoutine(e, routine)} onDelete={(e) => onDeleteRoutine(e, routine)} onDuplicate={(e) => onDuplicateRoutine(e, routine.id)} onStartWorkout={(e) => onStartWorkout(e, routine.id)} onDragStart={(e) => onDragStart(e, {type: 'routine', id: routine.id, source: { folderId: folder.id }})} onDragEnd={onDragEnd} onDrop={onItemDrop} onTouchStart={onTouchStart} isDragging={draggingItem?.type === 'routine' && draggingItem.id === routine.id} isTouchDevice={isTouchDevice} dropIndicator={dropIndicator} />
                            {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'bottom' && <div className="h-1.5 bg-secondary rounded-full my-1"></div>}
                        </React.Fragment>
                    ))}
                    {routines.length === 0 && <div className="text-center py-4 text-sm text-light-text-secondary italic">Pasta vazia</div>}
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
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent) => void;
    onTouchStart: (e: React.TouchEvent, item: DraggingItem, element: HTMLElement) => void;
    isDragging: boolean;
    isTouchDevice: boolean;
    dropIndicator: { targetId: string; type: string; position: 'top' | 'bottom' } | null;
}

const RoutineItem = ({ routine, onEdit, onDelete, onDuplicate, onStartWorkout, onDragStart, onDragEnd, onDrop, onTouchStart, isDragging, isTouchDevice, dropIndicator }: RoutineItemProps) => {
    const itemRef = useRef<HTMLDivElement>(null);
    return (
        <div ref={itemRef} data-drag-id={routine.id} data-drag-type="routine" onDrop={onDrop} className={`bg-light-card dark:bg-dark-card rounded-lg shadow-sm border-l-4 p-4 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`} style={{ borderLeftColor: routine.color }}>
            <div className="flex justify-between items-start">
                <div className="flex items-center min-w-0">
                    <div draggable={!isTouchDevice} onDragStart={onDragStart} onDragEnd={onDragEnd} onTouchStart={(e) => onTouchStart(e, {type: 'routine', id: routine.id, source: { folderId: routine.folderId }}, itemRef.current!)} className="p-2 -ml-2 cursor-grab"><GripVerticalIcon className="h-5 w-5 text-light-text-secondary" /></div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-lg truncate">{routine.name}</h4>
                        <p className="text-sm text-light-text-secondary truncate">{routine.plannedExercises.length} exercícios</p>
                    </div>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={onDuplicate} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary hover:text-primary"><CopyIcon className="h-5 w-5" /></button>
                    <button onClick={onEdit} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary hover:text-light-text"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={onDelete} className="p-2 hover:bg-light-bg dark:hover:bg-dark-bg rounded-full text-light-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
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
    const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>(routineToEdit?.plannedExercises || []);
    const [notes, setNotes] = useState(routineToEdit?.notes || '');
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);

    /* Fixed: Folder object does not have 'label' property, using 'name' */
    const folderOptions = [{ value: 'none', label: 'Nenhuma Pasta' }, ...allFolders.map(f => ({ value: f.id, label: f.name }))];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return alert("O nome da rotina é obrigatório.");
        if (plannedExercises.length === 0) return alert("Adicione ao menos um exercício à rotina.");
        onSave({ name, color, folderId: folderId === 'none' ? null : folderId, plannedExercises, notes });
    };

    const handleAddPlannedExercise = (ex: Exercise) => {
        setPlannedExercises([...plannedExercises, { exerciseId: ex.id, sets: [{}], notes: '' }]);
        setIsExercisePickerOpen(false);
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">{routineToEdit ? 'Editar Rotina' : 'Nova Rotina'}</h3>
                    <button onClick={onClose}><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto space-y-6 pr-2">
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
                                <div key={exIndex} className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg">{exIndex + 1}. {ex.name}</span>
                                            <button type="button" onClick={() => setInfoExercise(ex)} className="p-1 text-light-text-secondary hover:text-blue-500"><InfoIcon className="h-5 w-5" /></button>
                                        </div>
                                        <button type="button" onClick={() => setPlannedExercises(plannedExercises.filter((_, i) => i !== exIndex))} className="text-red-500"><TrashIcon className="h-5 w-5" /></button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input type="text" value={pe.notes || ''} onChange={e => handleUpdatePlannedExercise(exIndex, { notes: e.target.value })} placeholder="Anotações para este exercício..." className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm" />
                                        {ex.includeBarbellWeight && <input type="number" value={pe.barbellWeight || ''} onChange={e => handleUpdatePlannedExercise(exIndex, { barbellWeight: Number(e.target.value) })} placeholder="Peso da Barra (kg)" className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm" />}
                                    </div>
                                    <div className="space-y-2">
                                        {pe.sets.map((set, setIndex) => (
                                            <div key={setIndex} className="flex flex-wrap items-center gap-2 bg-light-card dark:bg-dark-card p-2 rounded-md">
                                                <span className="text-xs font-bold w-full sm:w-auto">Série {setIndex + 1}</span>
                                                {ex.measurementType === MeasurementType.COUNT ? (
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" value={set.repsMin || ''} onChange={e => handleUpdateSet(exIndex, setIndex, { repsMin: Number(e.target.value) })} placeholder="Mín" className="w-16 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-sm" />
                                                        <span>-</span>
                                                        <input type="number" value={set.repsMax || ''} onChange={e => handleUpdateSet(exIndex, setIndex, { repsMax: Number(e.target.value) })} placeholder="Máx" className="w-16 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-sm" />
                                                        <span className="text-xs">reps</span>
                                                    </div>
                                                ) : (
                                                    <TimeInput id={`time-${exIndex}-${setIndex}`} valueInSeconds={set.time} onChangeInSeconds={s => handleUpdateSet(exIndex, setIndex, { time: s })} placeholder="00:00" className="w-20 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-sm" />
                                                )}
                                                {ex.unit !== Unit.NONE && <div className="flex items-center gap-1"><input type="number" value={set.value || ''} onChange={e => handleUpdateSet(exIndex, setIndex, { value: Number(e.target.value) })} className="w-16 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-1 text-center text-sm" /><span className="text-xs">{ex.unit}</span></div>}
                                                {scaleOptions && <div className="w-32 h-10"><EffortPicker options={scaleOptions} value={set.effort} onChange={v => handleUpdateSet(exIndex, setIndex, { effort: v })} placeholder="Esforço" /></div>}
                                                <button type="button" onClick={() => { const ns = [...pe.sets]; ns.splice(setIndex, 1); handleUpdatePlannedExercise(exIndex, { sets: ns }); }} className="text-light-text-secondary hover:text-red-500 ml-auto"><XIcon className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => handleUpdatePlannedExercise(exIndex, { sets: [...pe.sets, {}] })} className="text-xs text-primary font-bold hover:underline">+ Adicionar Série</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </form>
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
                    <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-700 py-2 px-6 rounded-md font-bold">Cancelar</button>
                    <button type="button" onClick={handleSubmit} className="bg-secondary text-white py-2 px-6 rounded-md font-bold">Salvar Rotina</button>
                </div>
            </div>
            {isExercisePickerOpen && <ExercisePickerModal onClose={() => setIsExercisePickerOpen(false)} onSelect={handleAddPlannedExercise} allExercises={allExercises} />}
            {infoExercise && <ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />}
        </div>
    );
};

const FolderFormModal = ({ onClose, onSave, folderToEdit }: { onClose: () => void; onSave: (data: Partial<Folder>) => void; folderToEdit: Folder | null; }) => {
    const [name, setName] = useState(folderToEdit?.name || '');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold mb-4">{folderToEdit ? 'Editar Pasta' : 'Nova Pasta'}</h3>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Nome da Pasta</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" autoFocus /></div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-700 py-2 px-4 rounded-md font-bold">Cancelar</button>
                        <button type="button" onClick={() => { if(name.trim()) onSave({ name }); }} className="bg-primary text-white py-2 px-4 rounded-md font-bold">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExercisePickerModal = ({ onClose, onSelect, allExercises }: { onClose: () => void; onSelect: (ex: Exercise) => void; allExercises: Exercise[]; }) => {
    const [query, setQuery] = useState('');
    const filtered = allExercises.filter(ex => ex.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Selecionar Exercício</h3><button onClick={onClose}><XIcon className="h-6 w-6" /></button></div>
                <div className="relative mb-4"><SearchIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary" /><input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar..." className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md pl-10 pr-4 py-2" autoFocus /></div>
                <div className="flex-grow overflow-y-auto space-y-2">
                    {filtered.map(ex => (
                        <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left p-3 rounded-md flex items-center gap-3 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                            <div className="w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-md flex items-center justify-center">{ex.imageUrl ? <img src={ex.imageUrl} className="w-full h-full object-cover rounded-md" /> : <DumbbellIcon className="h-6 w-6 text-light-text-secondary" />}</div>
                            <span className="font-medium">{ex.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RoutinesScreen;
