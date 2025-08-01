
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, ExerciseCategory, MeasurementType, Unit, PerceivedExertionScale } from '../types';
import { DumbbellIcon, HeartPulseIcon, StretchIcon, PlusIcon, XIcon, PencilIcon, TrashIcon, ImageIcon, PlayIcon, SearchIcon, ChevronRightIcon, InfoIcon, CopyIcon, ChevronDownIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';

// Main Screen Component
const ExercisesScreen: React.FC = () => {
    const { exercises, muscleGroups, addExercise, updateExercise, deleteExercise, duplicateExercise, workouts } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
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
        setEditingExercise(null);
        setIsModalOpen(true);
    };

    const openEditModal = (exercise: Exercise) => {
        setEditingExercise(exercise);
        setIsModalOpen(true);
    };

    const handleSaveExercise = (exerciseData: Omit<Exercise, 'id'> | Exercise) => {
        if ('id' in exerciseData && exerciseData.id) {
            updateExercise(exerciseData as Exercise);
        } else {
            addExercise(exerciseData as Omit<Exercise, 'id'>);
        }
        setIsModalOpen(false);
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

            {isModalOpen && (
                <ExerciseFormModal
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveExercise}
                    exerciseToEdit={editingExercise}
                />
            )}
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

// Exercise Form Modal Component
interface ExerciseFormModalProps {
    onClose: () => void;
    onSave: (exercise: Omit<Exercise, 'id'> | Exercise) => void;
    exerciseToEdit: Exercise | null;
}

const ExerciseFormModal: React.FC<ExerciseFormModalProps> = ({ onClose, onSave, exerciseToEdit }) => {
    const { muscleGroups, addMuscleGroup } = useApp();
    const [name, setName] = useState(exerciseToEdit?.name || '');
    const [notes, setNotes] = useState(exerciseToEdit?.notes || '');
    const [category, setCategory] = useState<ExerciseCategory>(exerciseToEdit?.category || ExerciseCategory.RESISTED);
    const [primaryMuscles, setPrimaryMuscles] = useState<string[]>(exerciseToEdit?.primaryMuscles || []);
    const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(exerciseToEdit?.secondaryMuscles || []);
    const [measurementType, setMeasurementType] = useState<MeasurementType>(exerciseToEdit?.measurementType || MeasurementType.COUNT);
    const [unit, setUnit] = useState<Unit>(exerciseToEdit?.unit || Unit.KG);
    const [perceivedExertionScale, setPerceivedExertionScale] = useState<PerceivedExertionScale | undefined>(exerciseToEdit?.perceivedExertionScale);
    const [newMuscle, setNewMuscle] = useState('');
    const [imageUrl, setImageUrl] = useState(exerciseToEdit?.imageUrl || '');
    const [videoUrl, setVideoUrl] = useState(exerciseToEdit?.videoUrl || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categoryIcons: Record<ExerciseCategory, React.ReactNode> = {
        [ExerciseCategory.RESISTED]: <DumbbellIcon className="h-5 w-5 text-blue-400" />,
        [ExerciseCategory.CARDIO]: <HeartPulseIcon className="h-5 w-5 text-pink-400" />,
        [ExerciseCategory.FLEXIBILITY]: <StretchIcon className="h-5 w-5 text-green-400" />,
    };

    const categoryOptions: CustomSelectOption[] = Object.values(ExerciseCategory).map(cat => ({
        value: cat,
        label: cat,
        icon: categoryIcons[cat],
    }));

    const measurementTypeOptions: CustomSelectOption[] = [
        { value: MeasurementType.COUNT, label: 'Repetições' },
        { value: MeasurementType.TIME, label: MeasurementType.TIME },
    ];
    
    const unitOptions: CustomSelectOption[] = Object.values(Unit).map(u => ({
        value: u,
        label: u,
    }));

    const perceivedExertionScaleOptions: CustomSelectOption[] = Object.values(PerceivedExertionScale).map(pes => ({
        value: pes,
        label: pes,
    }));


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione um arquivo de imagem válido.');
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const youtubeId = useMemo(() => {
        if (!videoUrl) return null;
        // Regex to find YouTube video ID from various URL formats
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = videoUrl.match(regExp);
        if (match && match[2].length === 11) {
            return match[2];
        }
        return null;
    }, [videoUrl]);

    const handlePrimaryMuscleToggle = (muscle: string) => {
        const isCurrentlyPrimary = primaryMuscles.includes(muscle);
        if (isCurrentlyPrimary) {
            setPrimaryMuscles(prev => prev.filter(m => m !== muscle));
        } else {
            setPrimaryMuscles(prev => [...prev, muscle]);
            setSecondaryMuscles(prev => prev.filter(m => m !== muscle));
        }
    };

    const handleSecondaryMuscleToggle = (muscle: string) => {
        setSecondaryMuscles(prev =>
            prev.includes(muscle)
                ? prev.filter(m => m !== muscle)
                : [...prev, muscle]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || primaryMuscles.length === 0) {
            alert("Nome e ao menos um Músculo Primário são obrigatórios.");
            return;
        }

        const exerciseData = {
            name,
            notes: notes.trim() || undefined,
            category,
            primaryMuscles,
            secondaryMuscles,
            measurementType,
            unit,
            perceivedExertionScale,
            imageUrl: imageUrl.trim() || undefined,
            videoUrl: videoUrl.trim() || undefined,
        };

        if (exerciseToEdit) {
            onSave({ ...exerciseData, id: exerciseToEdit.id });
        } else {
            onSave(exerciseData);
        }
    };
    
    const handleAddMuscle = () => {
        const trimmedMuscle = newMuscle.trim();
        if(trimmedMuscle && !muscleGroups.includes(trimmedMuscle)) {
            addMuscleGroup(trimmedMuscle);
            setNewMuscle('');
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-lg max-h-[90vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">{exerciseToEdit ? 'Editar Exercício' : 'Novo Exercício'}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="overflow-y-auto pr-2 space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">Nome do Exercício</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                        </div>
                        
                        <div>
                            <label htmlFor="exerciseNotes" className="block text-sm font-medium mb-1">Anotações (Opcional)</label>
                            <textarea
                                id="exerciseNotes"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Ex: Focar na contração do músculo, manter a postura..."
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                            ></textarea>
                        </div>
                        
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium mb-1">Categoria</label>
                            <CustomSelect
                                id="category"
                                options={categoryOptions}
                                value={category}
                                onChange={val => setCategory(val as ExerciseCategory)}
                                allowDeselect={false}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="measurementType" className="block text-sm font-medium mb-1">Tipo de Medida</label>
                                 <CustomSelect
                                    id="measurementType"
                                    options={measurementTypeOptions}
                                    value={measurementType}
                                    onChange={val => setMeasurementType(val as MeasurementType)}
                                    allowDeselect={false}
                                />
                            </div>
                            <div>
                                <label htmlFor="unit" className="block text-sm font-medium mb-1">Unidade</label>
                                <CustomSelect
                                    id="unit"
                                    options={unitOptions}
                                    value={unit}
                                    onChange={val => setUnit(val as Unit)}
                                    allowDeselect={false}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="perceivedExertionScale" className="block text-sm font-medium mb-1">Escala de Esforço (Opcional)</label>
                             <CustomSelect
                                id="perceivedExertionScale"
                                options={perceivedExertionScaleOptions}
                                value={perceivedExertionScale}
                                onChange={val => setPerceivedExertionScale(val as PerceivedExertionScale | undefined)}
                                placeholder="Nenhuma"
                            />
                        </div>

                        <hr className="border-light-border dark:border-dark-border" />
                        
                        {/* Muscle Selection */}
                        <div>
                            <p className="block text-sm font-medium mb-2">Músculos Primários</p>
                            <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 bg-light-bg dark:bg-dark-bg rounded-md">
                                {muscleGroups.map(muscle => (
                                    <button type="button" key={muscle} onClick={() => handlePrimaryMuscleToggle(muscle)} className={`p-2 text-sm rounded-md border text-left truncate transition-colors ${primaryMuscles.includes(muscle) ? 'bg-primary text-white border-primary' : 'bg-transparent border-light-border dark:border-dark-border hover:bg-light-card dark:hover:bg-dark-card'}`}>
                                        {muscle}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <p className="block text-sm font-medium mb-2">Músculos Secundários</p>
                            <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 bg-light-bg dark:bg-dark-bg rounded-md">
                                {muscleGroups.filter(m => !primaryMuscles.includes(m)).map(muscle => (
                                    <button type="button" key={muscle} onClick={() => handleSecondaryMuscleToggle(muscle)} className={`p-2 text-sm rounded-md border text-left truncate transition-colors ${secondaryMuscles.includes(muscle) ? 'bg-secondary text-white border-secondary' : 'bg-transparent border-light-border dark:border-dark-border hover:bg-light-card dark:hover:bg-dark-card'}`}>
                                        {muscle}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Adicionar Novo Grupo Muscular</label>
                            <div className="flex space-x-2">
                                <input type="text" value={newMuscle} onChange={e => setNewMuscle(e.target.value)} placeholder="Ex: Rombóides" className="flex-grow bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                                <button type="button" onClick={handleAddMuscle} className="bg-primary hover:bg-primary-dark text-white font-bold p-2 rounded-md flex items-center justify-center">
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        
                        <hr className="border-light-border dark:border-dark-border" />

                        {/* Image and Video */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                                <label htmlFor="imageUrl" className="block text-sm font-medium">URL da Imagem (Opcional)</label>
                                <div className="flex items-center space-x-2">
                                    <input type="text" id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="flex-grow bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"><ImageIcon className="h-5 w-5"/></button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                </div>
                                <label htmlFor="videoUrl" className="block text-sm font-medium">URL do Vídeo (YouTube, Opcional)</label>
                                <input type="text" id="videoUrl" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-24 h-24 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {imageUrl ? <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-light-text-secondary" />}
                                </div>
                                <div className="w-24 h-24 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {youtubeId ? <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="Video Thumbnail" className="w-full h-full object-cover" /> : <PlayIcon className="h-8 w-8 text-light-text-secondary" />}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Footer with buttons */}
                    <div className="pt-4 flex justify-end items-center space-x-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExercisesScreen;
