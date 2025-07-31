

import React, { useState } from 'react';
import { useApp } from '../App';
import { Theme } from '../types';
import { PencilIcon, TrashIcon, PlusIcon, XIcon, SunIcon, MoonIcon, MonitorIcon, ChevronRightIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';

const SettingsScreen: React.FC = () => {
    const { muscleGroups, addMuscleGroup, editMuscleGroup, deleteMuscleGroup, theme, setTheme } = useApp();

    const [isMuscleSectionExpanded, setIsMuscleSectionExpanded] = useState(false);
    const [newMuscle, setNewMuscle] = useState('');
    const [editingMuscle, setEditingMuscle] = useState<{ oldName: string; newName: string } | null>(null);
    const [confirmDeleteMuscle, setConfirmDeleteMuscle] = useState<string | null>(null);

    const handleAddMuscle = () => {
        const trimmed = newMuscle.trim();
        if (trimmed && !muscleGroups.includes(trimmed)) {
            addMuscleGroup(trimmed);
            setNewMuscle('');
        } else if (trimmed) {
            alert('Este grupo muscular já existe.');
        }
    };

    const handleConfirmDelete = () => {
        if (confirmDeleteMuscle) {
            deleteMuscleGroup(confirmDeleteMuscle);
            setConfirmDeleteMuscle(null);
        }
    };
    
    const handleStartEdit = (muscle: string) => {
        setEditingMuscle({ oldName: muscle, newName: muscle });
    };

    const handleSaveEdit = () => {
        if (editingMuscle) {
            editMuscleGroup(editingMuscle.oldName, editingMuscle.newName);
            setEditingMuscle(null);
        }
    };

    const themeOptions = [
        { id: Theme.LIGHT, name: 'Claro', icon: <SunIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.DARK, name: 'Escuro', icon: <MoonIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.SYSTEM, name: 'Sistema', icon: <MonitorIcon className="h-5 w-5 mr-2" /> },
    ];

    return (
        <div className="p-4 space-y-8">
            {/* Theme Selection */}
            <section>
                <h2 className="text-xl font-bold mb-3 text-light-text dark:text-dark-text">Tema</h2>
                <div className="flex space-x-2 rounded-lg bg-light-bg dark:bg-dark-card p-1">
                    {themeOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`w-full flex items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${
                                theme === option.id
                                    ? 'bg-primary text-white shadow'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-border'
                            }`}
                        >
                            {option.icon}
                            {option.name}
                        </button>
                    ))}
                </div>
            </section>

            {/* Muscle Group Management */}
            <section>
                <div 
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setIsMuscleSectionExpanded(!isMuscleSectionExpanded)}
                    aria-expanded={isMuscleSectionExpanded}
                    aria-controls="muscle-group-content"
                >
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Gerenciar Grupos Musculares</h2>
                    <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isMuscleSectionExpanded ? 'rotate-90' : ''}`} />
                </div>
                
                {isMuscleSectionExpanded && (
                    <div id="muscle-group-content" className="mt-3">
                        <div className="space-y-2">
                            {muscleGroups.map((muscle: string) => (
                                <div key={muscle} className="flex items-center justify-between bg-light-card dark:bg-dark-card p-3 rounded-lg">
                                    <span className="font-medium text-light-text dark:text-dark-text">{muscle}</span>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => handleStartEdit(muscle)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-dark-text" aria-label={`Editar ${muscle}`}>
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => setConfirmDeleteMuscle(muscle)} className="p-2 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500" aria-label={`Deletar ${muscle}`}>
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex space-x-2">
                            <input 
                                type="text" 
                                value={newMuscle} 
                                onChange={e => setNewMuscle(e.target.value)} 
                                placeholder="Novo grupo muscular" 
                                className="flex-grow bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-2 text-light-text dark:text-dark-text"
                            />
                            <button onClick={handleAddMuscle} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md flex items-center">
                                <PlusIcon className="h-5 w-5 mr-1" /> Adicionar
                            </button>
                        </div>
                    </div>
                )}
            </section>
            
            {/* Edit Muscle Modal */}
            {editingMuscle && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Editar Grupo Muscular</h3>
                            <button type="button" onClick={() => setEditingMuscle(null)} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="muscleName" className="block text-sm font-medium mb-1">Nome</label>
                                <input 
                                    type="text" 
                                    id="muscleName" 
                                    value={editingMuscle.newName} 
                                    onChange={e => setEditingMuscle(m => m ? { ...m, newName: e.target.value } : null)}
                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2" 
                                />
                            </div>
                            <div className="pt-2 flex justify-end space-x-3">
                                <button type="button" onClick={() => setEditingMuscle(null)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                                <button type="button" onClick={handleSaveEdit} className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            {confirmDeleteMuscle && (
                <ConfirmationModal
                    isOpen={!!confirmDeleteMuscle}
                    onClose={() => setConfirmDeleteMuscle(null)}
                    onConfirm={handleConfirmDelete}
                    title="Confirmar Exclusão"
                    message={
                        <>
                            <p>Tem certeza que deseja apagar o grupo muscular <strong>"{confirmDeleteMuscle}"</strong>?</p>
                            <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">Ele será removido de todos os exercícios que o utilizam.</p>
                        </>
                    }
                />
            )}
        </div>
    );
};

export default SettingsScreen;