import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../App';
import { WorkoutSession, Routine, ExerciseCategory, Unit, MeasurementType, Evaluation, Exercise } from '../types';
import { ChevronRightIcon, FileTextIcon, BarChartIcon, SettingsIcon, CalendarIcon } from '../components/Icons';
import { BarChart, HorizontalBarChart, ChartData } from '../components/Charts';
import { parseEffortToNumber, formatSecondsToMMSS } from '../utils';
import CustomSelect from '../components/CustomSelect';


// Helper function to format a Date object to a 'YYYY-MM-DD' string for date inputs
const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Main StatsScreen Component
const StatsScreen: React.FC = () => {
    const { workouts, routines, exercises, muscleGroups, evaluations } = useApp();
    const [isGeralExpanded, setIsGeralExpanded] = useState(false);
    const [isResistidoExpanded, setIsResistidoExpanded] = useState(false);
    const [isCardioExpanded, setIsCardioExpanded] = useState(false);
    const [isFlexibilidadeExpanded, setIsFlexibilidadeExpanded] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Map of exerciseId -> selected testId for reference
    const [selectedReferences, setSelectedReferences] = useState<Record<string, string>>({});

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

    // Identify all cardio exercises performed in the filtered period
    const cardioExercisesInPeriod = useMemo(() => {
        const foundIds = new Set<string>();
        filteredWorkouts.forEach(w => {
            w.loggedExercises.forEach(le => {
                const ex = exercises.find(e => e.id === le.exerciseId);
                if (ex?.category === ExerciseCategory.CARDIO) {
                    foundIds.add(le.exerciseId);
                }
            });
        });
        return Array.from(foundIds).map(id => exercises.find(e => e.id === id)!).filter(Boolean);
    }, [filteredWorkouts, exercises]);

    // Available reference tests for each exercise
    const availableTestsByExercise = useMemo(() => {
        const map: Record<string, { value: string, label: string }[]> = {};
        
        workouts.forEach(w => {
            if (!w.completed || w.routineId !== 'internal_test') return;
            const logEx = w.loggedExercises[0];
            const notes = logEx?.notes || '';
            if (notes.includes('5 minutos') || notes.includes('Incremental')) {
                if (!map[logEx.exerciseId]) map[logEx.exerciseId] = [];
                const type = notes.includes('5 minutos') ? '5min' : 'Inc';
                map[logEx.exerciseId].push({
                    value: w.id,
                    label: `${new Date(`${w.date}T00:00:00`).toLocaleDateString('pt-BR')} - ${type}`
                });
            }
        });

        // Sort each exercise tests by date descending
        Object.keys(map).forEach(id => {
            map[id].sort((a, b) => b.value.localeCompare(a.value));
        });

        return map;
    }, [workouts]);

    // Auto-select the latest test for each cardio exercise
    useEffect(() => {
        const newRefs = { ...selectedReferences };
        let changed = false;

        cardioExercisesInPeriod.forEach(ex => {
            if (!newRefs[ex.id]) {
                const tests = availableTestsByExercise[ex.id];
                if (tests && tests.length > 0) {
                    newRefs[ex.id] = tests[0].value; // First is most recent
                    changed = true;
                }
            }
        });

        if (changed) {
            setSelectedReferences(newRefs);
        }
    }, [cardioExercisesInPeriod, availableTestsByExercise]);

    // Cardiovascular intensity distribution calculation
    const cardioIntensityDistributionData = useMemo<ChartData[]>(() => {
        // Zonas
        const zones = {
            'Supramáximo (>100%)': { time: 0, color: '#7F1D1D' },
            'Máximo (100%)': { time: 0, color: '#EF4444' },
            'Severo (85-99%)': { time: 0, color: '#F97316' },
            'Pesado (63-84%)': { time: 0, color: '#F59E0B' },
            'Moderado (45-62%)': { time: 0, color: '#10B981' },
            'Leve (<45%)': { time: 0, color: '#3B82F6' },
        };

        // Cache para referências de intensidade (100%) para evitar recálculo
        const exerciseRefIntensity: Record<string, number> = {};

        // Pré-calcular intensidade de referência para cada exercício mapeado
        Object.entries(selectedReferences).forEach(([exId, testId]) => {
            const testWorkout = workouts.find(w => w.id === testId);
            if (!testWorkout) return;
            
            const testSets = testWorkout.loggedExercises[0].sets;
            const testNotes = testWorkout.loggedExercises[0].notes || '';
            
            let referenceIntensity = 0;
            if (testNotes.includes('5 minutos')) {
                referenceIntensity = testSets[0].value ?? 0;
            } else {
                const completed = testSets.filter(s => s.completed);
                referenceIntensity = completed.length > 0 ? (completed[completed.length - 1].value ?? 0) : (testSets[0].value ?? 0);
            }

            if (referenceIntensity > 0) {
                exerciseRefIntensity[exId] = referenceIntensity;
            }
        });

        filteredWorkouts.forEach(session => {
            session.loggedExercises.forEach(loggedEx => {
                const refIntensity = exerciseRefIntensity[loggedEx.exerciseId];
                if (!refIntensity) return;

                loggedEx.sets.forEach(set => {
                    const intensity = set.value ?? 0;
                    const durationSeconds = set.time ?? 0;
                    if (intensity <= 0 || durationSeconds <= 0) return;

                    const percentage = (intensity / refIntensity) * 100;
                    let zoneKey: keyof typeof zones;

                    if (percentage > 100) zoneKey = 'Supramáximo (>100%)';
                    else if (percentage >= 100) zoneKey = 'Máximo (100%)';
                    else if (percentage >= 85) zoneKey = 'Severo (85-99%)';
                    else if (percentage >= 63) zoneKey = 'Pesado (63-84%)';
                    else if (percentage >= 45) zoneKey = 'Moderado (45-62%)';
                    else zoneKey = 'Leve (<45%)';

                    zones[zoneKey].time += durationSeconds;
                });
            });
        });

        const chartItems = Object.entries(zones).map(([label, data]) => ({
            label,
            value: Math.round(data.time / 60), // Converter para minutos
            details: [{ name: 'Duração', value: Math.round(data.time / 60), color: data.color }]
        }));

        // Retornar apenas se houver algum tempo registrado
        return chartItems.some(i => i.value > 0) ? chartItems : [];
    }, [selectedReferences, filteredWorkouts, workouts]);

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
                
                let name = 'Rotina Apagada';
                let color = '#808080';

                if (w.routineId === 'internal_test') {
                    name = 'Teste Físico';
                    color = '#6B7280';
                } else {
                    const routine = routines.find((r: Routine) => r.id === w.routineId);
                    if (routine) {
                        name = routine.name;
                        color = routine.color;
                    }
                }
                
                if (durationInMinutes > 0) {
                    dayData.totalDuration += durationInMinutes;
                    dayData.details.push({
                        name,
                        value: durationInMinutes,
                        color
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
            
            let name = 'Rotina Apagada';
            let color = '#808080';
            if (w.routineId === 'internal_test') {
                name = 'Teste Físico';
                color = '#6B7280';
            } else {
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                if (routine) {
                    name = routine.name;
                    color = routine.color;
                }
            }
            
            let routineVolume = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.RESISTED && exercise.unit === Unit.KG) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue >= 7 || w.routineId === 'internal_test') {
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
                    name,
                    value: routineVolume,
                    color
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
            
            let name = 'Rotina Apagada';
            let color = '#808080';
            if (w.routineId === 'internal_test') {
                name = 'Teste Físico';
                color = '#6B7280';
            } else {
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                if (routine) {
                    name = routine.name;
                    color = routine.color;
                }
            }
            
            let routineInternalLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.RESISTED) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue > 0) {
                            routineInternalLoad += effortValue;
                        }
                    });
                }
            });
    
            if (routineInternalLoad > 0) {
                dayData.totalLoad += routineInternalLoad;
                dayData.details.push({
                    name,
                    value: routineInternalLoad,
                    color
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(1)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(1)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate]);
    
    // --- Lógica de classificação de intensidade por 1RM Dinâmico ---
    const seriesByMuscleGroupData = useMemo<ChartData[]>(() => {
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;

        // 1. Organizar TODOS os recordes históricos por exercício e data
        // exerciseId -> Array<{ date: string, oneRM: number }>
        const allOneRMRecords = new Map<string, { date: string, oneRM: number }[]>();
        
        workouts.filter(w => w.completed).forEach(session => {
            session.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (!exercise || exercise.category !== ExerciseCategory.RESISTED || exercise.unit !== Unit.KG) return;

                loggedEx.sets.forEach(set => {
                    const effortValue = parseEffortToNumber(set.effort);
                    // Base para recordes: PSE/RIR >= 9
                    if (effortValue < 9) return;

                    const reps = set.reps ?? 0;
                    const barbellWeight = loggedEx.barbellWeight ?? 0;
                    let load = (set.value ?? 0) + barbellWeight;
                    
                    if (exercise.isWeightDoubled) load *= 2;
                    else if (exercise.isCounterweight && latestBodyMass && load > 0) load = Math.max(0, latestBodyMass - load);
                    
                    if (reps > 0 && load > 0) {
                        const estimated1RM = load * (1 + reps / 30);
                        if (!allOneRMRecords.has(exercise.id)) allOneRMRecords.set(exercise.id, []);
                        allOneRMRecords.get(exercise.id)!.push({ date: session.date, oneRM: estimated1RM });
                    }
                });
            });
        });

        // Ordenar os recordes de cada exercício por data
        allOneRMRecords.forEach(records => records.sort((a, b) => a.date.localeCompare(b.date)));

        // 2. Processar os treinos do PERÍODO FILTRADO
        const intensityMap = new Map<string, Record<string, number>>();
        muscleGroups.forEach(muscle => {
            intensityMap.set(muscle, { 'Alta': 0, 'Moderada': 0, 'Leve': 0, 'Muito Leve': 0 });
        });

        filteredWorkouts.forEach((session: WorkoutSession) => {
            const sessionDate = session.date;

            session.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (!exercise || exercise.category !== ExerciseCategory.RESISTED) return;

                // Encontrar o MELHOR 1RM até a data deste treino (inclusive)
                const exerciseRecords = allOneRMRecords.get(exercise.id) || [];
                const max1RMAtThisPoint = exerciseRecords
                    .filter(r => r.date <= sessionDate)
                    .reduce((max, r) => Math.max(max, r.oneRM), 0);

                const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);

                loggedEx.sets.forEach(set => {
                    const effortValue = parseEffortToNumber(set.effort);
                    // Apenas séries efetivas (>= 7) ou testes de força
                    if (effortValue < 7 && session.routineId !== 'internal_test') return;

                    let intensityCategory = 'Moderada'; // Fallback

                    if (max1RMAtThisPoint > 0) {
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let currentLoad = (set.value ?? 0) + barbellWeight;
                        if (exercise.isWeightDoubled) currentLoad *= 2;
                        else if (exercise.isCounterweight && latestBodyMass && currentLoad > 0) currentLoad = Math.max(0, latestBodyMass - currentLoad);

                        const percentage = (currentLoad / max1RMAtThisPoint) * 100;
                        if (percentage >= 85) intensityCategory = 'Alta';
                        else if (percentage >= 60) intensityCategory = 'Moderada';
                        else if (percentage >= 30) intensityCategory = 'Leve';
                        else intensityCategory = 'Muito Leve';
                    }

                    uniqueMuscles.forEach(muscle => {
                        if (intensityMap.has(muscle)) {
                            const counts = intensityMap.get(muscle)!;
                            counts[intensityCategory]++;
                        }
                    });
                });
            });
        });

        // 3. Converter para o formato ChartData[]
        const intensityColors: Record<string, string> = {
            'Alta': '#EF4444',
            'Moderada': '#DB2777',
            'Leve': '#F59E0B',
            'Muito Leve': '#3B82F6'
        };

        return Array.from(intensityMap.entries())
            .map(([muscle, counts]) => {
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                const details = Object.entries(counts)
                    .filter(([, val]) => val > 0)
                    .map(([name, value]) => ({
                        name,
                        value,
                        color: intensityColors[name]
                    }));

                return {
                    label: muscle,
                    value: total,
                    details
                };
            })
            .filter(item => item.value > 0);
    }, [filteredWorkouts, workouts, exercises, muscleGroups, evaluations]);
    
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
            
            let name = 'Rotina Apagada';
            let color = '#808080';
            if (w.routineId === 'internal_test') {
                name = 'Teste Físico';
                color = '#6B7280';
            } else {
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                if (routine) {
                    name = routine.name;
                    color = routine.color;
                }
            }
            
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
                    name,
                    value: routineCardioLoad,
                    color
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(1)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(1)) })),
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
            
            let name = 'Rotina Apagada';
            let color = '#808080';
            if (w.routineId === 'internal_test') {
                name = 'Teste Físico';
                color = '#6B7280';
            } else {
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                if (routine) {
                    name = routine.name;
                    color = routine.color;
                }
            }
            
            let routineCardioInternalLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.CARDIO) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue > 0) {
                            routineCardioInternalLoad += effortValue;
                        }
                    });
                }
            });
    
            if (routineCardioInternalLoad > 0) {
                dayData.totalLoad += routineCardioInternalLoad;
                dayData.details.push({
                    name,
                    value: routineCardioInternalLoad,
                    color
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(1)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(1)) })),
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
            
            let name = 'Rotina Apagada';
            let color = '#808080';
            if (w.routineId === 'internal_test') {
                name = 'Teste Físico';
                color = '#6B7280';
            } else {
                const routine = routines.find((r: Routine) => r.id === w.routineId);
                if (routine) {
                    name = routine.name;
                    color = routine.color;
                }
            }
            
            let routineFlexibilityLoad = 0;
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.FLEXIBILITY) {
                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        if (effortValue > 0) {
                            routineFlexibilityLoad += effortValue;
                        }
                    });
                }
            });
    
            if (routineFlexibilityLoad > 0) {
                dayData.totalLoad += routineFlexibilityLoad;
                dayData.details.push({
                    name,
                    value: routineFlexibilityLoad,
                    color
                });
            }
        });
    
        return Array.from(dataByDate.entries()).map(([date, data]) => ({
            label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(data.totalLoad.toFixed(1)),
            details: data.details.map(d => ({ ...d, value: parseFloat(d.value.toFixed(1)) })),
        }));
    }, [filteredWorkouts, routines, exercises, startDate, endDate]);

    const seriesByMuscleGroupFlexibilityData = useMemo<ChartData[]>(() => {
        // Estrutura: muscle -> { category -> count }
        const intensityMap = new Map<string, Record<string, number>>();
        muscleGroups.forEach(muscle => {
            intensityMap.set(muscle, { 'Alta': 0, 'Moderada': 0, 'Leve': 0, 'Muito Leve': 0 });
        });

        filteredWorkouts.forEach((w: WorkoutSession) => {
            w.loggedExercises.forEach(loggedEx => {
                const exercise = exercises.find(e => e.id === loggedEx.exerciseId);
                if (exercise && exercise.category === ExerciseCategory.FLEXIBILITY) {
                    const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);

                    loggedEx.sets.forEach(set => {
                        const effortValue = parseEffortToNumber(set.effort);
                        let intensityCategory = 'Moderada';

                        if (effortValue >= 7) intensityCategory = 'Alta';
                        else if (effortValue >= 4) intensityCategory = 'Moderada';
                        else if (effortValue >= 2) intensityCategory = 'Leve';
                        else intensityCategory = 'Muito Leve';

                        uniqueMuscles.forEach(muscle => {
                            if (intensityMap.has(muscle)) {
                                const counts = intensityMap.get(muscle)!;
                                counts[intensityCategory]++;
                            }
                        });
                    });
                }
            });
        });

        const intensityColors: Record<string, string> = {
            'Alta': '#EF4444',
            'Moderada': '#DB2777',
            'Leve': '#F59E0B',
            'Muito Leve': '#3B82F6'
        };

        return Array.from(intensityMap.entries())
            .map(([muscle, counts]) => {
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                const details = Object.entries(counts)
                    .filter(([, val]) => val > 0)
                    .map(([name, value]) => ({
                        name,
                        value,
                        color: intensityColors[name]
                    }));

                return {
                    label: muscle,
                    value: total,
                    details
                };
            })
            .filter(item => item.value > 0);
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
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Séries por Grupo Muscular (Intensidade por 1RM Histórico)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Soma das séries efetivas classificadas pela carga em relação ao seu 1RM recorde na data de cada treino.</p>
                                    <HorizontalBarChart data={seriesByMuscleGroupData} unit="séries" />
                                </div>
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Externa (Kg)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (repetições x carga) para todas as séries.</p>
                                    <BarChart data={dailyVolumeData} isStacked={true} unit="Kg" />
                                </div>
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna (UA)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma da percepção subjetiva de esforço (PSE/RIR) de cada série realizada.</p>
                                    <BarChart data={dailyInternalLoadData} isStacked={true} unit="UA" />
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
                            <div className="pt-4 space-y-12">
                                {/* Cardiovascular Intensity Distribution Section moved to top */}
                                <div className="border-b border-light-border dark:border-dark-border pb-8">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Distribuição de Intensidade (Zonas)</h3>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Tempo agregado em cada zona metabólica. Selecione um teste de referência para cada exercício.</p>
                                    </div>

                                    {/* Reference Mapping UI */}
                                    {cardioExercisesInPeriod.length > 0 ? (
                                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg mb-8 space-y-4">
                                            <div className="flex items-center text-xs font-bold uppercase text-light-text-secondary mb-2">
                                                <SettingsIcon className="h-4 w-4 mr-2" /> Mapeamento de Referências (100%)
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {cardioExercisesInPeriod.map(ex => {
                                                    const availableTests = availableTestsByExercise[ex.id] || [];
                                                    return (
                                                        <div key={ex.id} className="space-y-1">
                                                            <label className="block text-[11px] font-semibold text-light-text dark:text-dark-text truncate">{ex.name}</label>
                                                            <CustomSelect 
                                                                options={availableTests}
                                                                value={selectedReferences[ex.id]}
                                                                onChange={(val) => setSelectedReferences(prev => ({ ...prev, [ex.id]: val || '' }))}
                                                                placeholder={availableTests.length > 0 ? "Escolha o teste base..." : "Nenhum teste encontrado"}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-light-text-secondary italic text-center mb-6">Nenhum exercício cardiovascular registrado no período para exibir o gráfico de zonas.</p>
                                    )}
                                    
                                    {cardioIntensityDistributionData.length > 0 ? (
                                        <div className="mt-6">
                                            <HorizontalBarChart data={cardioIntensityDistributionData} unit="min" sortData={false} />
                                            <div className="mt-6 flex gap-4 text-[10px] text-light-text-secondary justify-center flex-wrap">
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#7F1D1D'}}></span> Supramáximo (&gt;100%)</div>
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#EF4444'}}></span> Máximo (100%)</div>
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#F97316'}}></span> Severo (85-99%)</div>
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#F59E0B'}}></span> Pesado (63-84%)</div>
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#10B981'}}></span> Moderado (45-62%)</div>
                                                <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#3B82F6'}}></span> Leve {"(<45%)"}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        cardioExercisesInPeriod.length > 0 && (
                                            <div className="text-center p-8 border-2 border-dashed border-light-border dark:border-dark-border rounded-lg">
                                                <BarChartIcon className="h-8 w-8 mx-auto text-light-text-secondary opacity-30 mb-2" />
                                                <p className="text-sm text-light-text-secondary">Selecione ao menos um teste de referência acima para os exercícios realizados para visualizar a distribuição.</p>
                                            </div>
                                        )
                                    )}
                                </div>

                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Externa</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma de (tempo em min x (velocidade ou distância)) para todas as séries.</p>
                                    <BarChart data={dailyCardioLoadData} isStacked={true} unit="UA" />
                                </div>
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna (UA)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma da percepção subjetiva de esforço (PSE) de cada série realizada.</p>
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
                                <div>
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Séries por Grupo Muscular (Intensidade por PERFLEX)</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Soma do número de séries classificadas pela intensidade do esforço (Escala PERFLEX).</p>
                                    <HorizontalBarChart data={seriesByMuscleGroupFlexibilityData} unit="séries" />
                                </div>
                                <div className="pl-8">
                                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">Carga Interna</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">Cálculo: Soma da percepção subjetiva de esforço (PERFLEX) de cada série realizada.</p>
                                    <BarChart data={dailyFlexibilityLoadData} isStacked={true} unit="UA" />
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
