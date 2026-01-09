
import React, { useRef, useState } from 'react';
import { useApp } from '../App';
import { Theme } from '../types';
import { SunIcon, MoonIcon, MonitorIcon, ChevronRightIcon, ClipboardListIcon, DumbbellIcon, BarChartIcon, DownloadIcon, UploadIcon, FileTextIcon, XIcon, CheckCircleIcon } from '../components/Icons';

const SettingsScreen: React.FC = () => {
    const { 
        theme, 
        setTheme, 
        setIsPhysicalEvaluationScreenOpen,
        setIsMuscleGroupsScreenOpen,
        setIsPhysicalTestsScreenOpen,
        exportData,
        processImportFile,
        confirmImport,
        exportExerciseList
    } = useApp();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // Categorias de dados
    const [exportCategories, setExportCategories] = useState<string[]>(['exercises', 'routines', 'workouts', 'evaluations']);
    const [importCategories, setImportCategories] = useState<string[]>(['exercises', 'routines', 'workouts', 'evaluations']);
    const [importedDataSummary, setImportedDataSummary] = useState<any>(null);
    const [importedData, setImportedData] = useState<any>(null);

    const themeOptions = [
        { id: Theme.LIGHT, name: 'Claro', icon: <SunIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.DARK, name: 'Escuro', icon: <MoonIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.SYSTEM, name: 'Sistema', icon: <MonitorIcon className="h-5 w-5 mr-2" /> },
    ];

    const toggleExportCategory = (cat: string) => {
        setExportCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const toggleImportCategory = (cat: string) => {
        setImportCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const handleExportClick = () => {
        setIsExportModalOpen(true);
    };

    const handleConfirmExport = () => {
        if (exportCategories.length === 0) {
            alert("Selecione ao menos uma categoria para exportar.");
            return;
        }
        exportData(exportCategories);
        setIsExportModalOpen(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await processImportFile(e.target.files[0]);
                setImportedData(data);
                
                // Analisar contagem de dados
                const summary = {
                    exercises: data.exercises?.length || 0,
                    routines: data.routines?.length || 0,
                    workouts: data.workouts?.length || 0,
                    evaluations: data.evaluations?.length || 0
                };
                setImportedDataSummary(summary);
                setIsImportModalOpen(true);
            } catch (err) {
                console.error("Erro na leitura do arquivo", err);
                alert('Arquivo inválido ou corrompido.');
            }
            // Reset input so the same file can be selected again
            e.target.value = '';
        }
    };

    const handleConfirmImport = () => {
        if (importCategories.length === 0) {
            alert("Selecione ao menos uma categoria para importar.");
            return;
        }
        confirmImport(importedData, importCategories);
        setIsImportModalOpen(false);
    };

    return (
        <div className="p-4 space-y-8 pb-10">
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

            {/* General Settings Buttons */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Ferramentas</h2>
                 <button
                    onClick={() => setIsPhysicalEvaluationScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Abrir tela de avaliação física"
                >
                    <div className="flex items-center">
                        <ClipboardListIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Avaliação Física</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
                 <button
                    onClick={() => setIsPhysicalTestsScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Abrir tela de testes físicos"
                >
                    <div className="flex items-center">
                        <BarChartIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Testes Físicos</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
                 <button
                    onClick={() => setIsMuscleGroupsScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Gerenciar grupos musculares"
                >
                    <div className="flex items-center">
                        <DumbbellIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Grupos Musculares</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
            </section>

            {/* Backup Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Dados e Relatórios</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={handleExportClick}
                        className="flex items-center justify-center p-4 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-sm font-bold transition-colors"
                    >
                        <DownloadIcon className="h-5 w-5 mr-3" />
                        Exportar Backup
                    </button>
                    <button
                        onClick={handleImportClick}
                        className="flex items-center justify-center p-4 bg-secondary hover:bg-pink-700 text-white rounded-lg shadow-sm font-bold transition-colors"
                    >
                        <UploadIcon className="h-5 w-5 mr-3" />
                        Importar Backup
                    </button>
                    <button
                        onClick={exportExerciseList}
                        className="flex items-center justify-center p-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-sm font-bold transition-colors col-span-1 sm:col-span-2"
                    >
                        <FileTextIcon className="h-5 w-5 mr-3" />
                        Exportar Lista de Exercícios (.txt)
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
                    O backup exporta seus dados em um arquivo .json. Você pode escolher quais dados exportar ou importar.
                </p>
            </section>

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Exportar Dados</h3>
                            <button onClick={() => setIsExportModalOpen(false)} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg">
                                <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                            </button>
                        </div>
                        <p className="mb-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">Selecione o que deseja incluir no backup:</p>
                        <div className="space-y-3 mb-6">
                            {[
                                { id: 'exercises', label: 'Exercícios' },
                                { id: 'routines', label: 'Rotinas e Pastas' },
                                { id: 'workouts', label: 'Histórico de Treinos' },
                                { id: 'evaluations', label: 'Avaliações Físicas' }
                            ].map(item => (
                                <label key={item.id} className="flex items-center justify-between p-3 bg-light-bg dark:bg-dark-bg rounded-lg cursor-pointer border border-transparent hover:border-light-border dark:hover:border-dark-border">
                                    <span className="font-medium">{item.label}</span>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${exportCategories.includes(item.id) ? 'bg-primary border-primary' : 'border-light-text-secondary dark:border-dark-text-secondary'}`}>
                                        {exportCategories.includes(item.id) && <CheckCircleIcon className="h-4 w-4 text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={exportCategories.includes(item.id)} 
                                        onChange={() => toggleExportCategory(item.id)} 
                                    />
                                </label>
                            ))}
                        </div>
                        <button onClick={handleConfirmExport} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <DownloadIcon className="h-5 w-5 mr-2" />
                            Gerar Arquivo de Backup
                        </button>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Importar Dados</h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg">
                                <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                            </button>
                        </div>
                        <p className="mb-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">O arquivo contém os seguintes registros. Selecione o que deseja restaurar (sobrescreverá os dados atuais da categoria):</p>
                        <div className="space-y-3 mb-6">
                            {[
                                { id: 'exercises', label: 'Exercícios', count: importedDataSummary?.exercises },
                                { id: 'routines', label: 'Rotinas e Pastas', count: importedDataSummary?.routines },
                                { id: 'workouts', label: 'Histórico de Treinos', count: importedDataSummary?.workouts },
                                { id: 'evaluations', label: 'Avaliações Físicas', count: importedDataSummary?.evaluations }
                            ].map(item => (
                                <label key={item.id} className={`flex items-center justify-between p-3 bg-light-bg dark:bg-dark-bg rounded-lg border border-transparent ${item.count > 0 ? 'cursor-pointer hover:border-light-border dark:hover:border-dark-border' : 'opacity-50 cursor-not-allowed'}`}>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.label}</span>
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.count} registros encontrados</span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${importCategories.includes(item.id) && item.count > 0 ? 'bg-secondary border-secondary' : 'border-light-text-secondary dark:border-dark-text-secondary'}`}>
                                        {importCategories.includes(item.id) && item.count > 0 && <CheckCircleIcon className="h-4 w-4 text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        disabled={item.count === 0}
                                        checked={importCategories.includes(item.id) && item.count > 0} 
                                        onChange={() => toggleImportCategory(item.id)} 
                                    />
                                </label>
                            ))}
                        </div>
                        <button onClick={handleConfirmImport} className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <UploadIcon className="h-5 w-5 mr-2" />
                            Confirmar Importação
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsScreen;
