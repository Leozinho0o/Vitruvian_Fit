
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../App';
import { Exercise, ExerciseCategory, MeasurementType, Unit, PerceivedExertionScale } from '../types';
import { DumbbellIcon, HeartPulseIcon, StretchIcon, PlusIcon, XIcon, ImageIcon, PlayIcon } from '../components/Icons';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';

const ExerciseFormScreen: React.FC = () => {
    const {
        editingExercise,
        setEditingExercise,
        muscleGroups,
        addMuscleGroup,
        addExercise,
        updateExercise,
    } = useApp();

    const exerciseToEdit = typeof editingExercise === 'object' && editingExercise ? editingExercise : null;

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

    const onClose = () => {
        setEditingExercise(null);
    };

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
            updateExercise({ ...exerciseData, id: exerciseToEdit.id });
        } else {
            addExercise(exerciseData);
        }
        onClose();
    };
    
    const handleAddMuscle = () => {
        const trimmedMuscle = newMuscle.trim();
        if(trimmedMuscle && !muscleGroups.includes(trimmedMuscle)) {
            addMuscleGroup(trimmedMuscle);
            setNewMuscle('');
        }
    }

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding border-b border-light-border dark:border-dark-border">
                <h3 className="text-xl font-bold">{exerciseToEdit ? 'Editar Exercício' : 'Novo Exercício'}</h3>
                <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                    <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
            </header>

            <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                <div className="overflow-y-auto p-4 md:p-6 space-y-6 flex-grow">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Column 1: Core Info */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium mb-1">Nome do Exercício</label>
                                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2" />
                            </div>
                            
                            <div>
                                <label htmlFor="exerciseNotes" className="block text-sm font-medium mb-1">Anotações (Opcional)</label>
                                <textarea
                                    id="exerciseNotes"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Ex: Focar na contração do músculo, manter a postura..."
                                    className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2"
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

                        </div>

                        {/* Column 2: Muscles and Media */}
                        <div className="space-y-4">
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
                                    <input type="text" value={newMuscle} onChange={e => setNewMuscle(e.target.value)} placeholder="Ex: Rombóides" className="flex-grow bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2" />
                                    <button type="button" onClick={handleAddMuscle} className="bg-primary hover:bg-primary-dark text-white font-bold p-2 rounded-md flex items-center justify-center">
                                        <PlusIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <hr className="border-light-border dark:border-dark-border" />
                             
                            <div className="space-y-2">
                                <label className="block text-sm font-medium">Mídia (Opcional)</label>
                                <div className="grid grid-cols-2 gap-4 items-end">
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="imageUrl" className="block text-xs font-medium mb-1">URL da Imagem</label>
                                            <div className="flex items-center space-x-2">
                                                <input type="text" id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="flex-grow bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm" />
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"><ImageIcon className="h-5 w-5"/></button>
                                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                            </div>
                                        </div>
                                         <div>
                                            <label htmlFor="videoUrl" className="block text-xs font-medium mb-1">URL do Vídeo (YouTube)</label>
                                            <input type="text" id="videoUrl" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-sm" />
                                        </div>
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
                        </div>
                     </div>
                </div>

                <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 flex justify-end items-center space-x-3 safe-bottom-padding bg-light-card dark:bg-dark-card">
                    <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                    <button type="submit" className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                </footer>
            </form>
        </div>
    );
};

export default ExerciseFormScreen;
