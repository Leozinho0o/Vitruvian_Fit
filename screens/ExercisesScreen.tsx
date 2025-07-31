
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, ExerciseCategory, MeasurementType, Unit, PerceivedExertionScale } from '../types';
import { DumbbellIcon, HeartPulseIcon, StretchIcon, PlusIcon, XIcon, PencilIcon, TrashIcon, ImageIcon, PlayIcon, SearchIcon, ChevronRightIcon, InfoIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';
import ExerciseInfoModal from '../components/ExerciseInfoModal';

// Main Screen Component
const ExercisesScreen: React.FC = () => {
    const { exercises, muscleGroups, addExercise, updateExercise, deleteExercise, workouts } = useApp();
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
        return filteredExercises.reduce((acc, exercise) => {
            if (!acc[exercise.category]) {
                acc[exercise.category] = [];
            }
            acc[exercise.category].push(exercise);
            return acc;
        }, {} as Record<ExerciseCategory, Exercise[]>);
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
        <div className="relative h-full">
            <div className="p-4 lg:p-6 space-y-6 pb-40">
                {/* --- Search and Filter UI --- */}
                <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
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
                            className="hidden lg:flex bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg items-center flex-shrink-0 h-[42px]"
                            aria-label="Adicionar novo exercício"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" />
                            Novo Exercício
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Category Filter */}
                        <div className="flex-grow">
                             <label className="block text-sm font-medium mb-1 text-light-text dark:text-dark-text">Categoria</label>
                             <div className="flex space-x-1 rounded-lg bg-light-bg dark:bg-dark-card p-1">
                                {categoryFilterOptions.map(option => (
                                    <button
                                        key={option.label}
                                        onClick={() => setCategoryFilter(option.value)}
                                        className={`flex-1 flex items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${
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
                                 <ChevronRightIcon className={`h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isMuscleFilterOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {isMuscleFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-full sm:w-64 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-xl z-10 p-2 max-h-64 overflow-y-auto">
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
                className="fixed bottom-28 right-6 z-20 lg:hidden bg-secondary hover:bg-pink-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center"
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
}

const ExerciseListItem: React.FC<ExerciseListItemProps> = ({ exercise, onEdit, onDelete, onShowInfo }) => {
    return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg flex items-center justify-between gap-3">
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

            <div className="flex-grow pr-2 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-light-text dark:text-dark-text truncate">{exercise.name}</p>
                    {exercise.videoUrl && <PlayIcon className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />}
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{exercise.primaryMuscles.join(', ')}</p>
                {exercise.notes && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 italic truncate">
                        "{exercise.notes}"
                    </p>
                )}
            </div>

            <div className="flex items-center space-x-1 flex-shrink-0">
                 <button onClick={onShowInfo} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500" aria-label={`Informações sobre ${exercise.name}`}><InfoIcon className="h-5 w-5" /></button>
                 <button onClick={onEdit} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text" aria-label={`Editar ${exercise.name}`}><PencilIcon className="h-5 w-5" /></button>
                 <button onClick={onDelete} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Apagar ${exercise.name}`}><TrashIcon className="h-5 w-5" /></button>
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
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
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
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-sm font-medium mb-1">Categoria</label>
                        <select id="category" value={category} onChange={e => setCategory(e.target.value as ExerciseCategory)} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2">
                           {Object.values(ExerciseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Músculos Primários</label>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">Selecione um ou mais. Músculos selecionados aqui não aparecerão como secundários.</p>
                        <div className="w-full h-32 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 overflow-y-auto">
                            {muscleGroups.map((group: string) => (
                                <div key={group} className="flex items-center p-1 rounded">
                                    <input
                                        type="checkbox"
                                        id={`pm-${group}`}
                                        checked={primaryMuscles.includes(group)}
                                        onChange={() => handlePrimaryMuscleToggle(group)}
                                        className="h-4 w-4 rounded text-secondary bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-secondary mr-3"
                                    />
                                    <label htmlFor={`pm-${group}`} className="flex-1 cursor-pointer">{group}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Músculos Secundários (Opcional)</label>
                        <div className="w-full h-32 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 overflow-y-auto">
                            {muscleGroups
                                .filter((g: string) => !primaryMuscles.includes(g))
                                .map((group: string) => (
                                    <div key={group} className="flex items-center p-1 rounded">
                                        <input
                                            type="checkbox"
                                            id={`sm-${group}`}
                                            checked={secondaryMuscles.includes(group)}
                                            onChange={() => handleSecondaryMuscleToggle(group)}
                                            className="h-4 w-4 rounded text-secondary bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-secondary mr-3"
                                        />
                                        <label htmlFor={`sm-${group}`} className="flex-1 cursor-pointer">
                                            {group}
                                        </label>
                                    </div>
                                ))}
                        </div>
                    </div>
                    
                    <div className="flex space-x-2">
                        <input type="text" value={newMuscle} onChange={e => setNewMuscle(e.target.value)} placeholder="Adicionar novo grupo muscular" className="flex-grow bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" />
                        <button type="button" onClick={handleAddMuscle} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md">Adicionar</button>
                    </div>
                    
                    <hr className="border-light-border dark:border-dark-border" />

                    <h4 className="text-lg font-semibold">Recursos Visuais (Opcional)</h4>

                    <div>
                        <label className="block text-sm font-medium mb-1">Imagem</label>
                        {imageUrl && imageUrl.startsWith('data:image') ? (
                            <div className="mt-2 p-3 bg-light-bg dark:bg-dark-bg rounded-lg">
                                <p className="text-sm text-green-600 dark:text-green-400">✓ Imagem carregada do dispositivo.</p>
                                <button 
                                    type="button" 
                                    onClick={() => setImageUrl('')} 
                                    className="mt-1 text-sm text-red-600 dark:text-red-500 hover:underline"
                                >
                                    Remover
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div>
                                    <label htmlFor="imageUrl" className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">URL da Imagem</label>
                                    <input 
                                        type="url" 
                                        id="imageUrl" 
                                        value={imageUrl} 
                                        onChange={e => setImageUrl(e.target.value)} 
                                        placeholder="https://exemplo.com/imagem.jpg"
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <hr className="flex-grow border-light-border dark:border-dark-border"/>
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">OU</span>
                                    <hr className="flex-grow border-light-border dark:border-dark-border"/>
                                </div>
                                <input
                                    type="file"
                                    id="imageUpload"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/png, image/jpeg, image/gif, image/webp"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md text-sm"
                                >
                                    Carregar do Dispositivo
                                </button>
                            </div>
                        )}
                        
                        {imageUrl && (
                            <div className="mt-2 rounded-lg overflow-hidden bg-light-bg dark:bg-dark-bg flex justify-center items-center p-2">
                                <img 
                                    src={imageUrl} 
                                    alt="Pré-visualização" 
                                    className="max-h-48 w-auto object-contain rounded-md"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="videoUrl" className="block text-sm font-medium mb-1">URL do Vídeo (YouTube, etc.)</label>
                        <input 
                            type="url" 
                            id="videoUrl" 
                            value={videoUrl} 
                            onChange={e => setVideoUrl(e.target.value)} 
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                        />
                        {youtubeId && (
                            <div className="mt-2 aspect-video">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${youtubeId}`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="rounded-lg"
                                ></iframe>
                            </div>
                        )}
                    </div>
                    
                    <hr className="border-light-border dark:border-dark-border" />
                    
                    <h4 className="text-lg font-semibold">Medição Padrão</h4>

                     <div>
                        <label htmlFor="measurementType" className="block text-sm font-medium mb-1">Medido por</label>
                        <select id="measurementType" value={measurementType} onChange={e => setMeasurementType(e.target.value as MeasurementType)} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2">
                           {Object.values(MeasurementType).map(type => <option key={type} value={type}>{type === MeasurementType.COUNT ? 'Repetições' : 'Tempo'}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <label htmlFor="unit" className="block text-sm font-medium mb-1">Unidade de Medida</label>
                        <select id="unit" value={unit} onChange={e => setUnit(e.target.value as Unit)} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2">
                           {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Ex: KG para Repetições, Distância (m) para Tempo.</p>
                    </div>

                    <div>
                        <label htmlFor="perceivedExertionScale" className="block text-sm font-medium mb-1">Escala de Percepção de Esforço (Opcional)</label>
                        <select 
                            id="perceivedExertionScale" 
                            value={perceivedExertionScale || ''} 
                            onChange={e => setPerceivedExertionScale(e.target.value ? e.target.value as PerceivedExertionScale : undefined)} 
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                        >
                            <option value="">Nenhuma</option>
                            <option value={PerceivedExertionScale.PERFLEX}>PERFLEX (indicada para exercícios de flexibilidade)</option>
                            <option value={PerceivedExertionScale.RIR}>PSE baseada em repetições em reserva (indicada para exercícios resistidos)</option>
                            <option value={PerceivedExertionScale.PSE}>PSE (indicada para exercícios cardiovasculares)</option>
                        </select>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Define a escala para medir a intensidade subjetiva do exercício.</p>
                    </div>

                    <div className="pt-2 flex justify-end items-center space-x-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExercisesScreen;
