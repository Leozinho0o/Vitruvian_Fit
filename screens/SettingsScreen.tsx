
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { Theme } from '../types';
import { SunIcon, MoonIcon, MonitorIcon, ChevronRightIcon, ClipboardListIcon, DumbbellIcon, PlusIcon } from '../components/Icons';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';

const SettingsScreen: React.FC = () => {
    const { 
        theme, 
        setTheme, 
        setIsMeasurementsScreenOpen, 
        setIsMuscleGroupsScreenOpen,
        evaluations,
        setSelectedEvaluationDate 
    } = useApp();

    const [currentDate, setCurrentDate] = useState<string | undefined>();

    useEffect(() => {
        // Set the current date to the latest evaluation when the component mounts or evaluations change
        // and the user hasn't already selected a different one.
        if (evaluations && evaluations.length > 0) {
            const latestDate = evaluations[0].date;
            if (currentDate !== latestDate) {
                 setCurrentDate(latestDate);
            }
        } else {
             setCurrentDate(undefined);
        }
    }, [evaluations]);

    const evaluationOptions: CustomSelectOption[] = useMemo(() => 
        evaluations.map((ev: { date: string }) => ({
            value: ev.date,
            label: new Date(`${ev.date}T00:00:00`).toLocaleDateString('pt-BR', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
        })), [evaluations]
    );

    const themeOptions = [
        { id: Theme.LIGHT, name: 'Claro', icon: <SunIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.DARK, name: 'Escuro', icon: <MoonIcon className="h-5 w-5 mr-2" /> },
        { id: Theme.SYSTEM, name: 'Sistema', icon: <MonitorIcon className="h-5 w-5 mr-2" /> },
    ];

    const handleEditMeasurements = () => {
        if (currentDate) {
            setSelectedEvaluationDate(currentDate);
            setIsMeasurementsScreenOpen(true);
        } else if (evaluations.length > 0) {
            alert('Por favor, selecione uma avaliação para editar.');
        } else {
            // No evaluations exist, go directly to create new
            handleNewMeasurement();
        }
    };

    const handleNewMeasurement = () => {
        setSelectedEvaluationDate(null);
        setIsMeasurementsScreenOpen(true);
    };

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

            <section>
                <h2 className="text-xl font-bold mb-3 text-light-text dark:text-dark-text">Data da avaliação</h2>
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg space-y-4">
                    <CustomSelect
                        id="evaluationDate"
                        options={evaluationOptions}
                        value={currentDate}
                        onChange={(val) => setCurrentDate(val)}
                        placeholder="Nenhuma avaliação salva"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleEditMeasurements}
                            className="w-full flex-1 flex justify-center items-center cursor-pointer p-3 bg-light-bg dark:bg-dark-border rounded-lg shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            <ClipboardListIcon className="h-5 w-5 mr-3 text-primary" />
                            <span className="font-semibold text-light-text dark:text-dark-text">Editar / Ver Medições</span>
                        </button>
                         <button
                            onClick={handleNewMeasurement}
                            className="w-full sm:w-auto flex justify-center items-center cursor-pointer p-3 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-sm"
                            aria-label="Adicionar nova avaliação"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" />
                            <span className="font-semibold">Nova Avaliação</span>
                        </button>
                    </div>
                </div>
            </section>
            
            {/* General Settings Buttons */}
            <section className="space-y-4">
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