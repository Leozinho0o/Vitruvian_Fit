
import React, { useMemo, useState } from 'react';
import { useApp } from '../App';
import { WorkoutSession, Routine, ExerciseCategory, Unit, MeasurementType, Evaluation } from '../types';
import { ChevronRightIcon, FileTextIcon } from '../components/Icons';
import { BarChart, HorizontalBarChart, ChartData } from '../components/Charts';
import { parseEffortToNumber } from '../utils';


// Helper function to format a Date object to a 'YYYY-MM-DD' string for date inputs
const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Main StatsScreen Component
const StatsScreen: React.FC = () => {
    const { workouts, routines, exercises, muscleGroups, evaluations } = useApp();
    const [isGeralExpanded, setIsGeralExpanded] = useState(true);
    const [isResistidoExpanded, setIsResistidoExpanded] = useState(true);
    const [isCardioExpanded, setIsCardioExpanded] = useState(false);
    const [isFlexibilidadeExpanded, setIsFlexibilidadeExpanded] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Default to last 5 days
    const [endDate, setEndDate] = useState(formatDateForInput(new Date()));
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 4); // Set to 4 days ago for a 5-day total period
        return formatDateForInput(d);
    });

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);

        const wereExpanded = {
            geral: isGeralExpanded,
            resistido: isResistidoExpanded,
            cardio: isCardioExpanded,
            flexibilidade: isFlexibilidadeExpanded,
        };

        // Expand all sections to ensure they are rendered for capture
        setIsGeralExpanded(true);
        setIsResistidoExpanded(true);
        setIsCardioExpanded(true);
        setIsFlexibilidadeExpanded(true);

        // Wait for UI to re-render with expanded sections
        await new Promise(resolve => setTimeout(resolve, 500));

        const { jsPDF } = (window as any).jspdf;
        const html2canvas = (window as any).html2canvas;

        if (!jsPDF || !html2canvas) {
            alert("Erro ao carregar bibliotecas de PDF. Por favor, recarregue a página.");
            setIsGeneratingPdf(false);
            return;
        }

        const captureArea = document.getElementById('pdf-capture-area');
        if (!captureArea) {
            console.error("Capture area not found!");
            setIsGeneratingPdf(false);
            return;
        }

        try {
            const canvas = await html2canvas(captureArea, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                logging: false,
                backgroundColor: window.getComputedStyle(document.body).backgroundColor,
            });
            
            const imgData = canvas.toDataURL('image/png');
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            // Create a PDF with dimensions based on the captured canvas
            const pdf = new jsPDF({
                orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvasWidth, canvasHeight],
            });

            // Add the image to the PDF, covering the entire page
            pdf.addImage(imgData, 'PNG', 0, 0, canvasWidth, canvasHeight);
            
            const startDateFormatted = new Date(`${startDate}T00:00:00`).toLocaleDateString('pt-BR');
            const endDateFormatted = new Date(`${endDate}T00:00:00`).toLocaleDateString('pt-BR');
            pdf.save(`Relatorio_Vitruvian_Fit_${startDateFormatted}_a_${endDateFormatted}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
        } finally {
            setIsGeneratingPdf(false);
            // Restore original expanded state
            setIsGeralExpanded(wereExpanded.geral);
            setIsResistidoExpanded(wereExpanded.resistido);
            setIsCardioExpanded(wereExpanded.cardio);
            setIsFlexibilidadeExpanded(wereExpanded.flexibilidade);
        }
    };


    const filteredWorkouts = useMemo(() => {
         if (!startDate || !endDate) return [];
         const start = new Date(`${startDate}T00:00:00`);
         const end = new Date(`${endDate}T23:59:59`);
         return workouts
            .filter((w: WorkoutSession) => {
                if (!w.completed || !w.date) return false;
                const workoutDate = new Date(`${w.date}T00:00:00`);
                return workoutDate >= start && workoutDate <= end;
            });
    }, [workouts, startDate, endDate]);

    const dailyDurationData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalDuration: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        
        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalDuration: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (dataByDate.has(dateKey)) {
                const dayData = dataByDate.get(dateKey)!;
                const durationInMinutes = Math.round((w.duration || 0) / 60);
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                
                if (durationInMinutes > 0) {
                    dayData.totalDuration += durationInMinutes;
                    dayData.details.push({
                        name: routine?.name || 'Rotina Apagada',
                        value: durationInMinutes,
                        color: routine?.color || '#808080' // Gray for deleted routines
                    });
                }
            }
        });
        
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: data.totalDuration,
            details: data.details,
        }));
    }, [filteredWorkouts, routines, startDate, endDate]);
    
    const dailyVolumeData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalVolume: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;

        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalVolume: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (!dataByDate.has(dateKey)) return;

            const dayData = dataByDate.get(dateKey)!;
            const routine = routines.find((r: Routine) => r.id === w.routineId);
            
            let routineVolume = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.RESISTED && exercise.unit === Unit.KG) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue >= 7) {
                            const reps = set.reps ?? 0;
                            const setValue = (set.value ?? 0) + (loggedEx.barbellWeight ?? 0);
                            let calculatedLoad;
                
                            if (exercise.isCounterweight && latestBodyMass && setValue > 0) {
                                calculatedLoad = Math.max(0, latestBodyMass - setValue);
                            } else {
                                calculatedLoad = exercise.isWeightDoubled ? (setValue * 2) : setValue;
                            }
                
                            if (reps > 0 && calculatedLoad > 0) {
                                routineVolume += reps * calculatedLoad;
                            }
                        }
                    });
                }
            });

            if (routineVolume > 0) {
                dayData.totalVolume += routineVolume;
                dayData.details.push({
                    name: routine?.name || 'Rotina Apagada',
                    value: routineVolume,
                    color: routine?.color || '#808080'
                });
            }
        });

        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: Math.round(data.totalVolume), // Round to nearest integer for display
            details: data.details.map(d => ({ ...d, value: Math.round(d.value) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate, evaluations]);

    const dailyInternalLoadData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalLoad: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;
    
        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalLoad: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (!dataByDate.has(dateKey)) return;
    
            const dayData = dataByDate.get(dateKey)!;
            const routine = routines.find((r: Routine) => r.id === w.routineId);
            
            let routineInternalLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.RESISTED) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue >= 7) {
                            const reps = set.reps ?? 0;
                            const setValue = (set.value ?? 0) + (loggedEx.barbellWeight ?? 0);
                            let calculatedLoad;

                            if (exercise.isCounterweight && latestBodyMass && setValue > 0) {
                                calculatedLoad = Math.max(0, latestBodyMass - setValue);
                            } else {
                                calculatedLoad = exercise.isWeightDoubled ? (setValue * 2) : setValue;
                            }
                            
                            if (reps > 0 && calculatedLoad > 0) {
                                const weightedLoad = reps * calculatedLoad * effortValue;
                                routineInternalLoad += weightedLoad;
                            }
                        }
                    });
                }
            });
    
            if (routineInternalLoad > 0) {
                dayData.totalLoad += routineInternalLoad;
                dayData.details.push({
                    name: routine?.name || 'Rotina Apagada',
                    value: routineInternalLoad,
                    color: routine?.color || '#808080'
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(2)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(2)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate, evaluations]);
    
    const seriesByMuscleGroupData = useMemo<ChartData[]>(() => {
        const dataByMuscle = new Map<string, number>();
        muscleGroups.forEach(muscle => {
            dataByMuscle.set(muscle, 0);
        });

        filteredWorkouts.forEach((w: WorkoutSession) => {
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.RESISTED) {
                    const numSets = loggedEx.sets.filter(set => parseEffortToNumber(set.effort) >= 7).length;
                    if (numSets > 0) {
                        const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);
                        uniqueMuscles.forEach(muscle => {
                            if (dataByMuscle.has(muscle)) {
                                dataByMuscle.set(muscle, dataByMuscle.get(muscle)! + numSets);
                            }
                        });
                    }
                }
            });
        });

        const chartData = Array.from(dataByMuscle.entries())
            .map(([muscle, count]) => ({
                label: muscle,
                value: count,
            }));

        return chartData;
    }, [filteredWorkouts, exercises, muscleGroups]);
    
    const dailyCardioLoadData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalLoad: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
    
        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalLoad: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (!dataByDate.has(dateKey)) return;
    
            const dayData = dataByDate.get(dateKey)!;
            const routine = routines.find((r: Routine) => r.id === w.routineId);
            
            let routineCardioLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.CARDIO) {
                    loggedEx.sets.forEach(set => {
                        const timeInSeconds = set.time ?? 0;
                        const timeInMinutes = timeInSeconds / 60;
                        const value = set.value ?? 0;
                        if (timeInMinutes > 0 && value > 0) {
                            routineCardioLoad += timeInMinutes * value;
                        }
                    });
                }
            });
    
            if (routineCardioLoad > 0) {
                dayData.totalLoad += routineCardioLoad;
                dayData.details.push({
                    name: routine?.name || 'Rotina Apagada',
                    value: routineCardioLoad,
                    color: routine?.color || '#808080'
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(2)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(2)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate]);

    const dailyCardioInternalLoadData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalLoad: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
    
        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalLoad: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (!dataByDate.has(dateKey)) return;
    
            const dayData = dataByDate.get(dateKey)!;
            const routine = routines.find((r: Routine) => r.id === w.routineId);
            
            let routineCardioInternalLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.CARDIO) {
                    loggedEx.sets.forEach(set => {
                        const timeInSeconds = set.time ?? 0;
                        const timeInMinutes = timeInSeconds / 60;
                        const effortValue = parseEffortToNumber(set.effort);
                        const value = set.value ?? 0; // Speed or distance
                        if (timeInMinutes > 0 && effortValue > 0) {
                            routineCardioInternalLoad += timeInMinutes * value * effortValue;
                        }
                    });
                }
            });
    
            if (routineCardioInternalLoad > 0) {
                dayData.totalLoad += routineCardioInternalLoad;
                dayData.details.push({
                    name: routine?.name || 'Rotina Apagada',
                    value: routineCardioInternalLoad,
                    color: routine?.color || '#808080'
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(2)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(2)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate]);

    const dailyFlexibilityLoadData = useMemo<ChartData[]>(() => {
        if (!startDate || !endDate) return [];
        
        const dataByDate = new Map<string, { totalLoad: number; details: { name: string; value: number; color: string }[] }>();
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
    
        // Initialize all days in the range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateKey = formatDateForInput(currentDate);
            dataByDate.set(dateKey, { totalLoad: 0, details: [] });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        // Populate with workout data
        filteredWorkouts.forEach((w: WorkoutSession) => {
            const dateKey = w.date;
            if (!dataByDate.has(dateKey)) return;
    
            const dayData = dataByDate.get(dateKey)!;
            const routine = routines.find((r: Routine) => r.id === w.routineId);
            
            let routineFlexibilityLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.FLEXIBILITY) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        let baseValue = 0;

                        if (exercise.measurementType === MeasurementType.TIME) {
                            const timeInSeconds = set.time ?? 0;
                            baseValue = timeInSeconds / 60; // Time in minutes
                        } else { // MeasurementType.COUNT
                            baseValue = set.reps ?? 0;
                        }

                        if (baseValue > 0 && effortValue > 0) {
                            routineFlexibilityLoad += baseValue * effortValue;
                        }
                    });
                }
            });
    
            if (routineFlexibilityLoad > 0) {
                dayData.totalLoad += routineFlexibilityLoad;
                dayData.details.push({
                    name: routine?.name || 'Rotina Apagada',
                    value: routineFlexibilityLoad,
                    color: routine?.color || '#808080'
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(2)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(2)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate]);

    const seriesByMuscleGroupFlexibilityData = useMemo<ChartData[]>(() => {
        const dataByMuscle = new Map<string, number>();
        muscleGroups.forEach(muscle => {
            dataByMuscle.set(muscle, 0);
        });

        filteredWorkouts.forEach((w: WorkoutSession) => {
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.FLEXIBILITY) {
                    const numSets = loggedEx.sets.length;
                    if (numSets > 0) {
                        const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);
                        uniqueMuscles.forEach(muscle => {
                            if (dataByMuscle.has(muscle)) {
                                dataByMuscle.set(muscle, dataByMuscle.get(muscle)! + numSets);
                            }
                        });
                    }
                }
            });
        });

        const chartData = Array.from(dataByMuscle.entries())
            .map(([muscle, count]) => ({
                label: muscle,
                value: count,
            }));

        return chartData;
    }, [filteredWorkouts, exercises, muscleGroups]);

    return (
        <div className="p-4 overflow-y-auto overflow-x-auto h-full">
            <div id="pdf-capture-area" className="inline-block min-w-full space-y-6">
                <section className="bg-light-card dark:bg-dark-card p-4 rounded-lg">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">Filtro de Período</h2>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Selecione um intervalo para visualizar as estatísticas dos treinos concluídos.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium mb-1">Data de Início</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                max={endDate}
                            />
                        </div>
                        <div>
                             <label htmlFor="endDate" className="block text-sm font-medium mb-1">Data Final</label>
                             <input
                                type="date"
                                id="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                min={startDate}
                                max={formatDateForInput(new Date())}
                            />
                        </div>
                     </div>
                     <div className="mt-6">
                        <button
                            onClick={handleGeneratePdf}
                            disabled={isGeneratingPdf}
                            className="w-full flex items-center justify-center bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-lg transition-opacity disabled:opacity-50"
                            aria-label="Gerar relatório em PDF"
                        >
                            {isGeneratingPdf ? (
                                'Gerando PDF...'
                            ) : (
                                <>
                                    <FileTextIcon className="h-6 w-6 mr-2" />
                                    Gerar PDF
                                </>
                            )}
                        </button>
                    </div>
                </section>
            
                <section className="bg-light-card dark:bg-dark-card p-4 rounded-lg">
                    <button
                        className="w-full flex justify-between items-center cursor-pointer"
                        onClick={() => setIsGeralExpanded(!isGeralExpanded)}
                        aria-expanded={isGeralExpanded}
                        aria-controls="geral-stats-content"
                    >
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Geral</h2>
                        <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isGeralExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isGeralExpanded && (
                        <div id="geral-stats-content" className="mt-4">
                            <div className="pl-8 pt-4 space-y-12">
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">Duração Diária dos Treinos</h3>
                                    <BarChart data={dailyDurationData} isStacked={true} unit="min" />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="bg-light-card dark:bg-dark-card p-4 rounded-lg">
                    <button
                        className="w-full flex justify-between items-center cursor-pointer"
                        onClick={() => setIsResistidoExpanded(!isResistidoExpanded)}
                        aria-expanded={isResistidoExpanded}
                        aria-controls="resistido-stats-content"
                    >
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Resistido</h2>
                        <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isResistidoExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isResistidoExpanded && (
                        <div id="resistido-stats-content" className="mt-4">
                            <div className="pt-4 space-y-12">
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Externa (Kg)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (repetições x carga) para todas as séries com esforço &ge; 7.</p>
                                    <BarChart data={dailyVolumeData} isStacked={true} unit="Kg" />
                                </div>
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna (UA)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (repetições x carga x esforço) para todas as séries com esforço &ge; 7.</p>
                                    <BarChart data={dailyInternalLoadData} isStacked={true} unit="UA" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Séries por Grupo Muscular</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Soma do número de séries com esforço &ge; 7 de todos os exercícios resistidos que trabalham cada grupo muscular.</p>
                                    <HorizontalBarChart data={seriesByMuscleGroupData} unit="séries" />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="bg-light-card dark:bg-dark-card p-4 rounded-lg">
                    <button
                        className="w-full flex justify-between items-center cursor-pointer"
                        onClick={() => setIsCardioExpanded(!isCardioExpanded)}
                        aria-expanded={isCardioExpanded}
                        aria-controls="cardio-stats-content"
                    >
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Cardiovascular</h2>
                        <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isCardioExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isCardioExpanded && (
                        <div id="cardio-stats-content" className="mt-4">
                            <div className="pl-8 pt-4 space-y-12">
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Externa</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (tempo em min x (velocidade ou distância)) para todas as séries.</p>
                                    <BarChart data={dailyCardioLoadData} isStacked={true} unit="UA" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna (UA)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (tempo em min x (velocidade ou distância) x PSE) para todas as séries.</p>
                                    <BarChart data={dailyCardioInternalLoadData} isStacked={true} unit="UA" />
                                </div>
                            </div>
                        </div>
                    )}
                </section>
                <section className="bg-light-card dark:bg-dark-card p-4 rounded-lg">
                    <button
                        className="w-full flex justify-between items-center cursor-pointer"
                        onClick={() => setIsFlexibilidadeExpanded(!isFlexibilidadeExpanded)}
                        aria-expanded={isFlexibilidadeExpanded}
                        aria-controls="flexibilidade-stats-content"
                    >
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Flexibilidade</h2>
                        <ChevronRightIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isFlexibilidadeExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isFlexibilidadeExpanded && (
                        <div id="flexibilidade-stats-content" className="mt-4">
                            <div className="pt-4 space-y-12">
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de ((tempo em min ou repetições) x esforço) para todas as séries.</p>
                                    <BarChart data={dailyFlexibilityLoadData} isStacked={true} unit="UA" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Séries por Grupo Muscular</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Soma do número de séries de todos os exercícios de flexibilidade que trabalham cada grupo muscular.</p>
                                    <HorizontalBarChart data={seriesByMuscleGroupFlexibilityData} unit="séries" />
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default StatsScreen;
