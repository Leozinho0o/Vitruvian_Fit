import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Routine, Folder, Exercise, ExerciseCategory, PlannedExercise, WorkoutSet, MeasurementType, Unit, PerceivedExertionScale, Evaluation } from '../types';
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
    interface DraggingItem { type: 'routine' | 'folder'; id: string; source: { folderId: string | null; }; }
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
    
     // --- Drag and Drop Handlers (Mouse & Touch) ---

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
    
    const handleItemDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    
        if (draggingItem && dropIndicator) {
            const { type: draggedType, id: draggedId } = draggingItem;
            const { type: targetType, targetId, position } = dropIndicator;
            
            if (draggedType === targetType && draggedId !== targetId) {
                if (draggedType === 'routine') {
                    reorderRoutines(draggedId, targetId, position);
                } else if (draggedType === 'folder') {
                    reorderFolders(draggedId, targetId, position);
                }
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

    const handleDragEnd = () => {
        stopScrolling();
        setDraggingItem(null);
        setDropTarget(null);
        setDropIndicator(null);
    };

    const handleTouchStart = (e: React.TouchEvent, item: DraggingItem, element: HTMLElement) => {
        e.preventDefault();

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
        }, 200);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!dragStartInfo.current) return;
        
        // If drag hasn't started yet, check for movement to cancel it (treat as scroll)
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

        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const rect = container.getBoundingClientRect();
            const y = touch.clientY - rect.top;
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
    };

    const handleTouchEnd = () => {
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }
        
        // Handle reordering drop
        if (draggingItem && dropIndicator) {
            const { type: draggedType, id: draggedId } = draggingItem;
            const { type: targetType, targetId, position } = dropIndicator;

            if (draggedType === targetType && draggedId !== targetId) {
                if (draggedType === 'routine') {
                    reorderRoutines(draggedId, targetId, position);
                } else if (draggedType === 'folder') {
                    reorderFolders(draggedId, targetId, position);
                }
            }
        } 
        // Handle folder drop
        else if (draggingItem?.type === 'routine' && dropTarget) {
            if (dropTarget.type === 'folder') {
                moveRoutineToFolder(draggingItem.id, dropTarget.id);
            } else if (dropTarget.type === 'root') {
                 moveRoutineToFolder(draggingItem.id, null);
            }
        }
        
        stopScrolling();
        setDraggingItem(null);
        setDropTarget(null);
        setDropIndicator(null);
        setGhostElement(null);
        dragStartInfo.current = null;
    };


    return (
        <div 
            ref={scrollContainerRef}
            className="relative h-full overflow-y-auto"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onDragOver={handleDragOver}
            onDragLeave={stopScrolling}
            onDrop={(e) => handleFolderDrop(e, {type: 'root', id: null})}
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
                    <React.Fragment key={folder.id}>
                        {dropIndicator?.targetId === folder.id && dropIndicator.type === 'folder' && dropIndicator.position === 'top' && (
                            <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                        )}
                        <FolderItem
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
                            isDropTarget={dropTarget?.type === 'folder' && dropTarget.id === folder.id}
                            draggingItem={draggingItem}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onTouchStart={handleTouchStart}
                            onFolderDrop={handleFolderDrop}
                            onItemDrop={handleItemDrop}
                            isTouchDevice={isTouchDevice}
                            dropIndicator={dropIndicator}
                        />
                         {dropIndicator?.targetId === folder.id && dropIndicator.type === 'folder' && dropIndicator.position === 'bottom' && (
                            <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                        )}
                    </React.Fragment>
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
                        onDragStart={(e) => handleDragStart(e, {type: 'routine', id: routine.id, source: { folderId: routine.folderId }})}
                        onDragEnd={handleDragEnd}
                        onDrop={handleItemDrop}
                        onTouchStart={handleTouchStart}
                        isDragging={draggingItem?.type === 'routine' && draggingItem.id === routine.id}
                        isTouchDevice={isTouchDevice}
                        dropIndicator={dropIndicator}
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

            {ghostElement && <GhostItem {...ghostElement} />}

            {/* FAB and Add Options for Mobile */}
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
                    evaluations={evaluations}
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
    draggingItem: { type: 'routine' | 'folder'; id: string; } | null;
    onDragStart: (e: React.DragEvent, item: { type: 'routine' | 'folder'; id: string; source: { folderId: string | null; } }) => void;
    onDragEnd: () => void;
    onTouchStart: (e: React.TouchEvent, item: { type: 'routine' | 'folder'; id: string; source: { folderId: string | null; } }, element: HTMLElement) => void;
    onFolderDrop: (e: React.DragEvent, target: {type: 'folder' | 'root', id: string | null}) => void;
    onItemDrop: (e: React.DragEvent) => void;
    isTouchDevice: boolean;
    dropIndicator: { targetId: string; type: string; position: 'top' | 'bottom' } | null;
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, routines, onEditRoutine, onDeleteRoutine, onDuplicateRoutine, onStartWorkout, onEditFolder, onDeleteFolder, onShowStats, isDropTarget, draggingItem, onDragStart, onDragEnd, onTouchStart, onFolderDrop, onItemDrop, isTouchDevice, dropIndicator }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const folderRef = useRef<HTMLDivElement>(null);
    const folderHeaderRef = useRef<HTMLDivElement>(null);
    const isDraggingThis = draggingItem?.type === 'folder' && draggingItem.id === folder.id;

    return (
        <div 
            ref={folderRef}
            data-folder-id={folder.id}
            className={`bg-light-card dark:bg-dark-card rounded-lg border-2 transition-colors ${isDraggingThis ? 'opacity-40' : ''} ${isDropTarget && draggingItem?.type === 'routine' ? 'border-primary bg-primary/20' : 'border-transparent'}`}
            onDrop={(e) => onFolderDrop(e, {type: 'folder', id: folder.id})}
        >
            <div
                ref={folderHeaderRef}
                data-drag-id={folder.id}
                data-drag-type="folder"
                className={`p-3 transition-colors ${isDropTarget && draggingItem?.type === 'folder' ? 'bg-primary/10' : ''}`}
                onDrop={onItemDrop}
            >
                <div className="flex items-center justify-end space-x-2 mb-2">
                    <button onClick={onShowStats} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 dark:hover:text-blue-400"><InfoIcon className="h-5 w-5" /></button>
                    <button onClick={onEditFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={onDeleteFolder} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><TrashIcon className="h-5 w-5" /></button>
                </div>
                <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center min-w-0">
                        <div
                            draggable={!isTouchDevice}
                            onDragStart={(e) => {
                                e.stopPropagation();
                                onDragStart(e, { type: 'folder', id: folder.id, source: { folderId: null } });
                            }}
                            onDragEnd={onDragEnd}
                            onTouchStart={(e) => {
                                if (folderHeaderRef.current) {
                                    onTouchStart(e, { type: 'folder', id: folder.id, source: { folderId: null } }, folderHeaderRef.current);
                                }
                            }}
                            className="p-2 -ml-2 cursor-grab"
                            style={{ 
                                touchAction: 'none',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                             }}
                        >
                             <GripVerticalIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <FolderIcon className="h-6 w-6 mr-3 text-yellow-400 flex-shrink-0" />
                        <span className="font-bold text-lg text-light-text dark:text-dark-text truncate">{folder.name}</span>
                    </div>
                    <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                    {routines.map(routine => (
                        <RoutineItem 
                            key={routine.id}
                            routine={routine}
                            onEdit={(e) => onEditRoutine(e, routine)}
                            onDelete={(e) => onDeleteRoutine(e, routine)}
                            onDuplicate={(e) => onDuplicateRoutine(e, routine.id)}
                            onStartWorkout={(e) => onStartWorkout(e, routine.id)}
                            onDragStart={(e) => onDragStart(e, {type: 'routine', id: routine.id, source: { folderId: routine.folderId }})}
                            onDragEnd={onDragEnd}
                            onDrop={onItemDrop}
                            onTouchStart={onTouchStart}
                            isDragging={draggingItem?.type === 'routine' && draggingItem.id === routine.id}
                            isTouchDevice={isTouchDevice}
                            dropIndicator={dropIndicator}
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
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onTouchStart: (e: React.TouchEvent, item: { type: 'routine' | 'folder'; id: string; source: { folderId: string | null; } }, element: HTMLElement) => void;
    isDragging: boolean;
    isTouchDevice: boolean;
    dropIndicator: { targetId: string; type: string; position: 'top' | 'bottom' } | null;
}

const RoutineItem: React.FC<RoutineItemProps> = ({ routine, onEdit, onDelete, onDuplicate, onStartWorkout, onDragStart, onDragEnd, onDrop, onTouchStart, isDragging, isTouchDevice, dropIndicator }) => {
    const routineRef = useRef<HTMLDivElement>(null);
    return (
        <React.Fragment>
             {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'top' && (
                <div className="h-1.5 bg-secondary rounded-full my-1"></div>
            )}
            <div 
                ref={routineRef}
                data-drag-id={routine.id}
                data-drag-type="routine"
                className={`bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex flex-col gap-2 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                onDrop={onDrop}
            >
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-1 flex-shrink-0">
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
                
                {/* Title */}
                <div className="flex items-center flex-grow min-w-0">
                     <div
                        draggable={!isTouchDevice}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onTouchStart={(e) => { if(routineRef.current) onTouchStart(e, {type: 'routine', id: routine.id, source: { folderId: routine.folderId }}, routineRef.current)}}
                        className="cursor-grab p-2 -ml-2"
                        style={{ 
                            touchAction: 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none',
                        }}
                    >
                        <GripVerticalIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                    </div>
                    <span className="h-4 w-4 rounded-sm mr-3 flex-shrink-0" style={{ backgroundColor: routine.color }}></span>
                    <span className="font-semibold text-light-text dark:text-dark-text truncate">{routine.name}</span>
                </div>

                {/* Notes row */}
                {routine.notes && (
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic break-words">
                        "{routine.notes}"
                    </p>
                )}
            </div>
             {dropIndicator?.targetId === routine.id && dropIndicator.type === 'routine' && dropIndicator.position === 'bottom' && (
                <div className="h-1.5 bg-secondary rounded-full my-1"></div>
            )}
        </React.Fragment>
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

interface RoutineFormModalProps {
    onClose: () => void;
    onSave: (data: Omit<Routine, 'id'> | Routine) => void;
    routineToEdit: Routine | null;
    allExercises: Exercise[];
    allFolders: Folder[];
}

type DraggablePlannedExercise = PlannedExercise & { dragId: string };

const RoutineFormModal: React.FC<RoutineFormModalProps> = ({ onClose, onSave, routineToEdit, allExercises, allFolders }) => {
    const [name, setName] = useState(routineToEdit?.name || '');
    const [color, setColor] = useState(routineToEdit?.color || ROUTINE_COLORS[0]);
    const [notes, setNotes] = useState(routineToEdit?.notes || '');
    const [folderId, setFolderId] = useState<string | null>(routineToEdit?.folderId || null);
    
    const [plannedExercises, setPlannedExercises] = useState<DraggablePlannedExercise[]>(
        (JSON.parse(JSON.stringify(routineToEdit?.plannedExercises || [])) as PlannedExercise[]).map((pex, index) => ({
            ...pex,
            dragId: `drag-item-${index}-${Math.random()}`
        }))
    );
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{targetId: string, position: 'top' | 'bottom'} | null>(null);

    // Refs for auto-scrolling and reordering logic
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
    const lastClientY = useRef<number>(0);

    const folderOptions: CustomSelectOption[] = allFolders.map(f => ({
        value: f.id,
        label: f.name,
        icon: <FolderIcon className="h-5 w-5 text-yellow-400" />
    }));

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

    const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
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

        if (!targetElement) {
            // If the cursor is between elements, do nothing and maintain the last indicator state.
            return;
        }

        const targetId = targetElement.dataset.dragId;
        if (!targetId || targetId === draggingId) {
            // Dragging over itself, do nothing.
            return;
        }

        const targetRect = targetElement.getBoundingClientRect();
        const midpointY = targetRect.top + targetRect.height / 2;
        const position = e.clientY < midpointY ? 'top' : 'bottom';

        if (dropIndicator?.targetId !== targetId || dropIndicator?.position !== position) {
            setDropIndicator({ targetId, position });
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!draggingId || !dropIndicator) {
            handleDragEnd();
            return;
        }

        const { targetId, position } = dropIndicator;
        
        setPlannedExercises(prev => {
            const draggedItem = prev.find(p => p.dragId === draggingId);
            if (!draggedItem) return prev;

            const items = prev.filter(p => p.dragId !== draggingId);
            
            let targetIndex = items.findIndex(p => p.dragId === targetId);
            if (targetIndex === -1) return prev; 
            
            if (position === 'bottom') {
                targetIndex++;
            }
            
            items.splice(targetIndex, 0, draggedItem);

            return items;
        });
        
        handleDragEnd();
    };

    const handleDragStart = (e: React.DragEvent, dragId: string) => {
        setDraggingId(dragId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
    };
    
    const handleDragEnd = () => {
        stopScrolling();
        setDraggingId(null);
        setDropIndicator(null);
    };

    const handleExerciseNoteChange = (exIndex: number, value: string) => {
        setPlannedExercises(prev => {
            const newExercises = [...prev];
            newExercises[exIndex] = { ...newExercises[exIndex], notes: value };
            return newExercises;
        });
    };

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
        setPlannedExercises(prev => [...prev, { 
            exerciseId, 
            sets: [{}], 
            notes: '',
            dragId: `drag-item-new-${Date.now()}`
        }]);
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
        
        const exercisesToSave = plannedExercises.map(({ dragId, ...rest }) => rest);
        
        onSave({ name, color, notes, folderId, plannedExercises: exercisesToSave });
    };

    return (
        <div className="fixed inset-0 bg-light-bg dark:bg-dark-bg z-50" aria-modal="true">
            <div className="h-full w-full max-w-4xl mx-auto bg-light-card dark:bg-dark-card flex flex-col text-light-text dark:text-dark-text">
                <header className="flex justify-between items-center p-4 border-b border-light-border dark:border-dark-border flex-shrink-0 safe-top-padding">
                    <h3 className="text-xl font-bold">{routineToEdit ? 'Editar Rotina' : 'Nova Rotina'}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div
                        ref={scrollContainerRef}
                        onDragOver={handleContainerDragOver}
                        onDragLeave={stopScrolling}
                        onDrop={handleDrop}
                        className="overflow-y-auto p-4 md:p-6 space-y-6 flex-grow"
                    >
                        {/* Routine Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="routineName" className="block text-sm font-medium mb-1">Nome da Rotina</label>
                                    <input type="text" id="routineName" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                                </div>
                                <div>
                                    <label htmlFor="folderId" className="block text-sm font-medium mb-1">Pasta (Opcional)</label>
                                    <CustomSelect
                                        id="folderId"
                                        options={folderOptions}
                                        value={folderId ?? undefined}
                                        onChange={(val) => setFolderId(val ?? null)}
                                        placeholder="Nenhuma"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="routineNotes" className="block text-sm font-medium mb-1">Anotações (Opcional)</label>
                                    <textarea id="routineNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Cor</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {ROUTINE_COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setColor(c)} className={`h-10 w-10 rounded-full border-4 transition-all duration-200 ${color === c ? 'border-primary scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`} style={{ backgroundColor: c }} aria-label={`Cor ${c}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <hr className="border-light-border dark:border-dark-border" />
                        
                        {/* Planned Exercises */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold">Exercícios</h4>
                            {plannedExercises.map((pex, exIndex) => {
                                const exercise = allExercises.find(e => e.id === pex.exerciseId);
                                if (!exercise) return null;
                                const scaleOptions = getScaleOptions(exercise.perceivedExertionScale);
                                const hasValueColumn = exercise.unit !== Unit.NONE;
                                
                                return (
                                <React.Fragment key={pex.dragId}>
                                    {dropIndicator?.targetId === pex.dragId && dropIndicator.position === 'top' && (
                                        <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                                    )}
                                    <div
                                        data-drag-id={pex.dragId}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, pex.dragId)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-light-bg dark:bg-dark-bg p-3 rounded-lg cursor-grab transition-opacity ${draggingId === pex.dragId ? 'opacity-40' : 'opacity-100'}`}
                                    >
                                        <div className="flex items-start mb-2">
                                            <div className="flex items-start gap-3 flex-grow min-w-0">
                                                <GripVerticalIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary mt-1 flex-shrink-0" />
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
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold break-words">{exercise.name}</p>
                                                        {exercise.isCounterweight && (
                                                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Contrapeso</span>
                                                        )}
                                                        {exercise.includeBarbellWeight && (
                                                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Peso da Barra</span>
                                                        )}
                                                        {exercise.isWeightDoubled && (
                                                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">Peso 2x</span>
                                                        )}
                                                        <button type="button" onClick={() => setInfoExercise(exercise)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 flex-shrink-0" aria-label={`Informações sobre ${exercise.name}`}>
                                                            <InfoIcon className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <textarea
                                            value={pex.notes || ''}
                                            onChange={(e) => handleExerciseNoteChange(exIndex, e.target.value)}
                                            placeholder="Anotações para este exercício (ex: cadência, foco)..."
                                            rows={2}
                                            className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm mb-3"
                                        />

                                        {exercise.includeBarbellWeight && (
                                            <div className="mb-3">
                                                <label htmlFor={`barbell-${exIndex}`} className="block text-sm font-medium mb-1">Peso da Barra (kg)</label>
                                                <input
                                                    type="number"
                                                    id={`barbell-${exIndex}`}
                                                    inputMode="decimal"
                                                    step="any"
                                                    value={pex.barbellWeight ?? ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setPlannedExercises(prev => {
                                                            const newExercises = [...prev];
                                                            newExercises[exIndex] = { ...newExercises[exIndex], barbellWeight: value };
                                                            return newExercises;
                                                        });
                                                    }}
                                                    placeholder="Ex: 20"
                                                    className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2"
                                                />
                                            </div>
                                        )}
                                        
                                        {/* Column Headers */}
                                        <div className="grid grid-cols-12 gap-x-2 items-center text-xs text-center font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 px-1">
                                            <div className="col-span-1">#</div>
                                            <div className={hasValueColumn ? "col-span-4" : "col-span-5"}>
                                                {exercise.measurementType === MeasurementType.COUNT ? 'Reps (Min-Max)' : 'Tempo'}
                                            </div>
                                            {hasValueColumn && (
                                                <div className="col-span-3">Valor</div>
                                            )}
                                            <div className={hasValueColumn ? "col-span-3" : "col-span-5"}>
                                                {scaleOptions ? 'Esforço' : ''}
                                            </div>
                                            <div className="col-span-1" aria-hidden="true" />
                                        </div>
                                        <div className="space-y-2">
                                            {pex.sets.map((set, setIndex) => (
                                                <div key={setIndex} className="grid grid-cols-12 gap-x-2 items-center">
                                                    <span className="col-span-1 text-center font-bold">{setIndex + 1}</span>
                                                    {exercise.measurementType === MeasurementType.COUNT ? (
                                                        <div className={`${hasValueColumn ? "col-span-4" : "col-span-5"} grid grid-cols-2 gap-x-1`}>
                                                            <input type="number" placeholder="Min Reps" value={set.repsMin ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'repsMin', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                            <input type="number" placeholder="Max Reps" value={set.repsMax ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'repsMax', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                        </div>
                                                    ) : (
                                                        <div className={hasValueColumn ? "col-span-4" : "col-span-5"}>
                                                            <TimeInput id={`time-${exIndex}-${setIndex}`} valueInSeconds={set.time} onChangeInSeconds={seconds => handleSetChange(exIndex, setIndex, 'time', seconds)} placeholder="MM:SS" className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                        </div>
                                                    )}
                                                    {hasValueColumn && (
                                                      <div className="col-span-3">
                                                        <input type="number" placeholder={exercise.unit} value={set.value ?? ''} onChange={e => handleSetChange(exIndex, setIndex, 'value', e.target.value ? Number(e.target.value) : undefined)} className="w-full text-center bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm" />
                                                      </div>
                                                    )}
                                                    <div className={`${hasValueColumn ? "col-span-3" : "col-span-5"} h-8`}>
                                                        {scaleOptions && (
                                                            <EffortPicker
                                                                value={set.effort}
                                                                onChange={(val) => handleSetChange(exIndex, setIndex, 'effort', val)}
                                                                options={scaleOptions}
                                                            />
                                                        )}
                                                    </div>
                                                    <button type="button" onClick={() => handleDeleteSet(exIndex, setIndex)} className="col-span-1 flex items-center justify-center p-1 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500"><XIcon className="h-4 w-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center mt-3">
                                            <button type="button" onClick={() => handleAddSet(exIndex)} className="text-sm font-semibold text-primary hover:underline p-1 -ml-1 flex items-center">
                                                <PlusIcon className="h-4 w-4 mr-1"/>
                                                Adicionar Série
                                            </button>
                                            <button type="button" onClick={() => handleRemoveExercise(exIndex)} className="p-1 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 flex-shrink-0" aria-label={`Remover ${exercise.name} da rotina`}>
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                     {dropIndicator?.targetId === pex.dragId && dropIndicator.position === 'bottom' && (
                                        <div className="h-1.5 bg-secondary rounded-full my-1"></div>
                                    )}
                                </React.Fragment>
                                );
                            })}
                            <button type="button" onClick={() => setIsExercisePickerOpen(true)} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center">
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Adicionar Exercício
                            </button>
                        </div>
                    </div>
                    
                    <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 flex justify-end items-center space-x-3 safe-bottom-padding bg-light-card dark:bg-dark-card">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </footer>
                </form>
                {isExercisePickerOpen && (
                    <ExercisePickerModal 
                        onClose={() => setIsExercisePickerOpen(false)}
                        onSelect={handleAddExerciseToRoutine}
                        allExercises={allExercises}
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