

import React from 'react';
import { useApp } from '../App';
import { Theme } from '../types';
import { SunIcon, MoonIcon, MonitorIcon, ChevronRightIcon, ClipboardListIcon, DumbbellIcon, BarChartIcon } from '../components/Icons';

const SettingsScreen: React.FC = () => {
    const { 
        theme, 
        setTheme, 
        setIsPhysicalEvaluationScreenOpen,
        setIsMuscleGroupsScreenOpen,
        setIsPhysicalTestsScreenOpen,
    } = useApp();

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

            {/* General Settings Buttons */}
            <section className="space-y-4">
                 <button
                    onClick={() => setIsPhysicalEvaluationScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-3 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Abrir tela de avaliação física"
                >
                    <div className="flex items-center">
                        <ClipboardListIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Avaliação Física</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
                 <button
                    onClick={() => setIsPhysicalTestsScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-3 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Abrir tela de testes físicos"
                >
                    <div className="flex items-center">
                        <BarChartIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Testes Físicos</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
                 <button
                    onClick={() => setIsMuscleGroupsScreenOpen(true)}
                    className="w-full flex justify-between items-center cursor-pointer p-3 bg-light-card dark:bg-dark-card rounded-lg shadow-sm hover:bg-light-bg dark:hover:bg-dark-border"
                    aria-label="Gerenciar grupos musculares"
                >
                    <div className="flex items-center">
                        <DumbbellIcon className="h-6 w-6 mr-4 text-primary"/>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Grupos Musculares</h2>
                    </div>
                    <ChevronRightIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary"/>
                </button>
            </section>
        </div>
    );
};

export default SettingsScreen;