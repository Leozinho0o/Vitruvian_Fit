
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, ExerciseCategory } from '../types';
import { DumbbellIcon, HeartPulseIcon, StretchIcon, PlusIcon, PencilIcon, TrashIcon, PlayIcon, SearchIcon, InfoIcon, CopyIcon, ChevronDownIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';

// Main Screen Component
const ExercisesScreen: React.FC = () => {
    const { exercises, muscleGroups, deleteExercise, duplicateExercise, setEditingExercise } = useApp();
    const [confirmDeleteInfo, setConfirmDeleteInfo] = useState<{ id: string; name: string } | null>(null);
    const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);


    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | null>(null);
    const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
    const [isMuscleFilterOpen, setIsMuscleFilterOpen] = useState(false);
    const muscleFilterRef = useRef<HTMLDivElement>(null);

    // Close muscle filter dropdown if clicked outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (muscleFilterRef.current && !muscleFilterRef.current.contains(event.target as Node)) {
                setIsMuscleFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [muscleFilterRef]);

    const openAddModal = () => {
        setEditingExercise('new');
    };

    const openEditModal = (exercise: Exercise) => {
        setEditingExercise(exercise);
    };

    const handleConfirmDelete = () => {
        if (confirmDeleteInfo) {
            deleteExercise(confirmDeleteInfo.id);
            setConfirmDeleteInfo(null);
        }
    };

    const handleMuscleFilterToggle = (muscle: string) => {
        setMuscleFilter(prev => 
            prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
        );
    };

    const filteredExercises = useMemo(() => {
        return exercises.filter(exercise => {
            const searchMatch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
            const categoryMatch = !categoryFilter || exercise.category === categoryFilter;
            const muscleMatch = muscleFilter.length === 0 || muscleFilter.every(m => 
                exercise.primaryMuscles.includes(m) || exercise.secondaryMuscles.includes(m)
            );
            return searchMatch && categoryMatch && muscleMatch;
        });
    }, [exercises, searchQuery, categoryFilter, muscleFilter]);

    const exercisesByCategory = useMemo(() => {
        const grouped = filteredExercises.reduce((acc, exercise) => {
            if (!acc[exercise.category]) {
                acc[exercise.category] = [];
            }
            acc[exercise.category].push(exercise);
            return acc;
        }, {} as Record<ExerciseCategory, Exercise[]>);

        // Sort exercises within each category alphabetically
        for (const category in grouped) {
            grouped[category as ExerciseCategory].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        }

        return grouped;
    }, [filteredExercises]);

    const categoryIcons: Record<ExerciseCategory, React.ReactNode> = {
        [ExerciseCategory.RESISTED]: <DumbbellIcon className="h-5 w-5 mr-3 text-blue-400" />,
        [ExerciseCategory.CARDIO]: <HeartPulseIcon className="h-5 w-5 mr-3 text-pink-400" />,
        [ExerciseCategory.FLEXIBILITY]: <StretchIcon className="h-5 w-5 mr-3 text-green-400" />,
    };
    
    const categoryFilterOptions: { label: string; value: ExerciseCategory | null }[] = [
        { label: 'Todos', value: null },
        { label: ExerciseCategory.RESISTED, value: ExerciseCategory.RESISTED },
        { label: ExerciseCategory.CARDIO, value: ExerciseCategory.CARDIO },
        { label: ExerciseCategory.FLEXIBILITY, value: ExerciseCategory.FLEXIBILITY }
    ];

    return (
        <div className="relative h-full overflow-y-auto overflow-x-auto">
            <div className="p-4 xl:p-6 space-y-6 pb-40">
                {/* --- Search and Filter UI --- */}
                <div className="space-y-4">
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                        {/* Search */}
                        <div className="relative flex-grow">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por nome do exercício..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg py-2 pl-10 pr-4 text-light-text dark:text-dark-text focus:ring-2 focus:ring-primary focus:border-primary transition-colors h-[42px]"
                                aria-label="Buscar exercícios"
                            />
                        </div>
                         {/* Desktop Add Button */}
                        <button
                            onClick={openAddModal}
                            className="hidden xl:flex bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg items-center flex-shrink-0 h-[42px]"
                            aria-label="Adicionar novo exercício"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" />
                            Novo Exercício
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Category Filter */}
                        <div className="flex-grow min-w-0">
                             <label className="block text-sm font-medium mb-1 text-light-text dark:text-dark-text">Categoria</label>
                             <div className="grid grid-cols-2 gap-1 rounded-lg bg-light-bg dark:bg-dark-card p-1">
                                {categoryFilterOptions.map(option => (
                                    <button
                                        key={option.label}
                                        onClick={() => setCategoryFilter(option.value)}
                                        className={`w-full whitespace-nowrap flex items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${
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

                        {/* Muscle Filter Dropdown */}
                        <div className="relative flex-shrink-0" ref={muscleFilterRef}>
                            <label className="block text-sm font-medium mb-1 text-light-text dark:text-dark-text">Músculos</label>
                             <button 
                                onClick={() => setIsMuscleFilterOpen(prev => !prev)} 
                                className="w-full sm:w-48 h-[42px] flex items-center justify-between bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg py-2 px-3 text-light-text dark:text-dark-text"
                            >
                                <span className="truncate">{muscleFilter.length > 0 ? `${muscleFilter.length} selecionado(s)` : 'Todos'}</span>
                                 <ChevronDownIcon className={`h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isMuscleFilterOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isMuscleFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-full sm:w-64 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-xl z-10 p-2 max-h-64 overflow-y-auto">
                                    <label className="flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={muscleFilter.length === 0}
                                            onChange={() => setMuscleFilter([])}
                                            className="h-4 w-4 text-secondary bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-secondary mr-3"
                                        />
                                        <span className="text-light-text dark:text-dark-text truncate font-semibold">Todos</span>
                                    </label>
                                    <hr className="my-1 border-light-border dark:border-dark-border" />
                                    {muscleGroups.map((muscle: string) => (
                                        <label key={muscle} className="flex items-center p-2 rounded-md hover:bg-light-bg dark:hover:bg-dark-bg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={muscleFilter.includes(muscle)}
                                                onChange={() => handleMuscleFilterToggle(muscle)}
                                                className="h-4 w-4 rounded text-secondary bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-secondary mr-3"
                                            />
                                            <span className="text-light-text dark:text-dark-text truncate">{muscle}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Exercise List --- */}
                {Object.values(ExerciseCategory).map(category => (
                    (exercisesByCategory[category] && exercisesByCategory[category].length > 0) && (
                        <div key={category}>
                            <h2 className="text-xl font-bold mb-3 flex items-center text-light-text dark:text-dark-text">
                                {categoryIcons[category]}
                                {category}
                            </h2>
                            <div className="space-y-2">
                                {exercisesByCategory[category].map(exercise => (
                                    <ExerciseListItem 
                                        key={exercise.id} 
                                        exercise={exercise} 
                                        onEdit={() => openEditModal(exercise)}
                                        onDelete={() => setConfirmDeleteInfo({ id: exercise.id, name: exercise.name })}
                                        onShowInfo={() => setInfoExercise(exercise)}
                                        onDuplicate={() => duplicateExercise(exercise.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                ))}
                 {filteredExercises.length === 0 && (
                    <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10">
                        <p>Nenhum exercício encontrado.</p>
                        <p>Tente ajustar os filtros ou a busca.</p>
                    </div>
                )}
            </div>

            <button
                onClick={openAddModal}
                className="fixed bottom-36 right-6 z-20 xl:hidden bg-secondary hover:bg-pink-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center"
                aria-label="Adicionar novo exercício"
            >
                <PlusIcon className="h-8 w-8" />
            </button>

             {confirmDeleteInfo && (
                <ConfirmationModal
                    isOpen={!!confirmDeleteInfo}
                    onClose={() => setConfirmDeleteInfo(null)}
                    onConfirm={handleConfirmDelete}
                    title="Confirmar Exclusão"
                    message={
                        <>
                            Tem certeza que deseja apagar o exercício <strong>"{confirmDeleteInfo.name}"</strong>? 
                            <span className="block mt-2">Esta ação não pode ser desfeita e o removerá de todas as rotinas.</span>
                        </>
                    }
                />
            )}
            {infoExercise && (
                <ExerciseInfoModal
                    exercise={infoExercise}
                    onClose={() => setInfoExercise(null)}
                />
            )}
        </div>
    );
};

// Exercise Item Component
interface ExerciseListItemProps {
    exercise: Exercise;
    onEdit: () => void;
    onDelete: () => void;
    onShowInfo: () => void;
    onDuplicate: () => void;
}

const ExerciseListItem: React.FC<ExerciseListItemProps> = ({ exercise, onEdit, onDelete, onShowInfo, onDuplicate }) => {
    return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg flex flex-col">
            {/* Top row: buttons are now at the top of the card */}
            <div className="flex justify-end items-center space-x-1 flex-shrink-0 -mt-1 -mr-1 mb-1">
                <button onClick={onShowInfo} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Informações sobre ${exercise.name}`}><InfoIcon className="h-5 w-5" /></button>
                <button onClick={onDuplicate} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-dark-text" aria-label={`Duplicar ${exercise.name}`}><CopyIcon className="h-5 w-5" /></button>
                <button onClick={onEdit} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text" aria-label={`Editar ${exercise.name}`}><PencilIcon className="h-5 w-5" /></button>
                <button onClick={onDelete} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Apagar ${exercise.name}`}><TrashIcon className="h-5 w-5" /></button>
            </div>
            
            {/* Content row: Image and text content are now siblings, aligned at the top */}
            <div className="flex gap-3 items-start">
                 {/* Image */}
                <div className="w-16 h-16 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center">
                    {exercise.imageUrl ? (
                        <img
                            src={exercise.imageUrl}
                            alt={exercise.name}
                            className="w-full h-full object-cover rounded-md"
                            loading="lazy"
                        />
                    ) : (
                        <DumbbellIcon className="h-8 w-8 text-light-text-secondary dark:text-dark-text-secondary" />
                    )}
                </div>

                {/* Text Content column */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-light-text dark:text-dark-text break-words">{exercise.name}</p>
                        {exercise.videoUrl && <PlayIcon className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary break-words">
                        <span className="font-semibold text-light-text dark:text-dark-text">{exercise.primaryMuscles.join(', ')}</span>
                        {exercise.secondaryMuscles.length > 0 && (
                            <span>, {exercise.secondaryMuscles.join(', ')}</span>
                        )}
                    </p>
                    {exercise.notes && (
                        <div className="mt-2">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic break-words">
                                "{exercise.notes}"
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExercisesScreen;
