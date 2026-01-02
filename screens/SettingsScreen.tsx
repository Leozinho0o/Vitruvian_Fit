
import React, { useRef } from 'react';
import { useApp } from '../App';
import { Theme } from '../types';
import { SunIcon, MoonIcon, MonitorIcon, ChevronRightIcon, ClipboardListIcon, DumbbellIcon, BarChartIcon, DownloadIcon, UploadIcon, FileTextIcon } from '../components/Icons';

const SettingsScreen: React.FC = () => {
    const { 
        theme, 
        setTheme, 
        setIsPhysicalEvaluationScreenOpen,
        setIsMuscleGroupsScreenOpen,
        setIsPhysicalTestsScreenOpen,
        exportData,
        importData,
        exportExerciseList
    } = useApp();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const themeOptions = [
        { id: Theme.LIGHT, name: 'Claro', icon: <SunIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.DARK, name: 'Escuro', icon: <MoonIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.SYSTEM, name: 'Sistema', icon: <MonitorIcon className="h-5 w-5 mr-2" /> },
    ];

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            importData(e.target.files[0]);
            // Reset input so the same file can be selected again
            e.target.value = '';
        }
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
                        onClick={exportData}
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
                    O backup exporta todos os seus dados em um arquivo .json. A lista de exercícios exporta um documento de texto com detalhes dos exercícios resistidos.
                </p>
            </section>
        </div>
    );
};

export default SettingsScreen;
