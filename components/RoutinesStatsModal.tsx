
import React, { useMemo, useState, useEffect } from 'react';
import { Routine, Exercise, ExerciseCategory, Unit, MeasurementType, Evaluation, WorkoutSession } from '../types';
import { useApp } from '../App';
import { XIcon, BarChartIcon, FileTextIcon, SettingsIcon } from './Icons';
import { HorizontalBarChart, ChartData } from './Charts';
import { parseEffortToNumber, getAverageReps, shareFile } from '../utils';
import CustomSelect from './CustomSelect';

interface RoutinesStatsModalProps {
    title: string;
    analyzedRoutines: Routine[];
    exercises: Exercise[];
    evaluations: Evaluation[];
    onClose: () => void;
}

const resistedLegend = [
    { label: 'Alta (≥ 85% 1RM)', color: '#DB2777' },
    { label: 'Moderada (60-84% 1RM)', color: '#F59E0B' },
    { label: 'Leve (30-59% 1RM)', color: '#10B981' },
    { label: 'Muito Leve (< 30% 1RM)', color: '#3B82F6' },
    { label: 'Indefinido', color: '#6B7280' },
];

const flexibilityLegend = [
    { label: 'Alta', color: '#DB2777' },
    { label: 'Moderada', color: '#F59E0B' },
    { label: 'Leve', color: '#10B981' },
    { label: 'Muito Leve', color: '#3B82F6' },
];

const StatCard: React.FC<{ title: string; value: string; unit: string }> = ({ title, value, unit }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{value} <span className="text-lg font-medium">{unit}</span></p>
    </div>
);

const RoutinesStatsModal: React.FC<RoutinesStatsModalProps> = ({ title, analyzedRoutines, exercises, evaluations, onClose }) => {
    const { muscleGroups, workouts } = useApp();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Map of exerciseId -> selected testId for reference
    const [selectedReferences, setSelectedReferences] = useState<Record<string, string>>({});

    // Identify unique cardio exercises in the analyzed routines
    const cardioExercisesInRoutines = useMemo(() => {
        const foundIds = new Set<string>();
        analyzedRoutines.forEach(r => {
            r.plannedExercises.forEach(pe => {
                const ex = exercises.find(e => e.id === pe.exerciseId);
                if (ex?.category === ExerciseCategory.CARDIO) {
                    foundIds.add(pe.exerciseId);
                }
            });
        });
        return Array.from(foundIds).map(id => exercises.find(e => e.id === id)!).filter(Boolean);
    }, [analyzedRoutines, exercises]);

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
        Object.keys(map).forEach(id => map[id].sort((a, b) => b.value.localeCompare(a.value)));
        return map;
    }, [workouts]);

    // Auto-select the latest test for each cardio exercise
    useEffect(() => {
        const newRefs = { ...selectedReferences };
        let changed = false;

        cardioExercisesInRoutines.forEach(ex => {
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
    }, [cardioExercisesInRoutines, availableTestsByExercise]);

    const stats = useMemo(() => {
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;
        
        // 1. Calculate historical max 1RM
        const max1RMMap = new Map<string, number>();
        workouts.filter((w: WorkoutSession) => w.completed).forEach((session: WorkoutSession) => {
            session.loggedExercises.forEach(loggedEx => {
                const ex = exercises.find(e => e.id === loggedEx.exerciseId);
                if (!ex || ex.category !== ExerciseCategory.RESISTED || ex.unit !== Unit.KG) return;

                loggedEx.sets.forEach(set => {
                    const effortValue = parseEffortToNumber(set.effort);
                    if (effortValue < 9.5) return; 

                    const reps = set.reps ?? 0;
                    const barbell = loggedEx.barbellWeight ?? 0;
                    let load = (set.value ?? 0) + barbell;
                    
                    if (ex.isWeightDoubled) load *= 2;
                    else if (ex.isCounterweight && latestBodyMass && load > 0) load = Math.max(0, latestBodyMass - load);
                    
                    if (reps > 0 && load > 0) {
                        const est1RM = load * (1 + reps / 30);
                        const currentMax = max1RMMap.get(ex.id) || 0;
                        if (est1RM > currentMax) max1RMMap.set(ex.id, est1RM);
                    }
                });
            });
        });

        // 2. Cardio References
        const cardioRefIntensities: Record<string, number> = {};
        Object.entries(selectedReferences).forEach(([exId, testId]) => {
            const testW = workouts.find(w => w.id === testId);
            if (!testW) return;
            const tSet = testW.loggedExercises[0].sets;
            const tNotes = testW.loggedExercises[0].notes || '';
            let ref = 0;
            if (tNotes.includes('5 minutos')) ref = tSet[0].value ?? 0;
            else {
                const comp = tSet.filter(s => s.completed);
                ref = comp.length > 0 ? (comp[comp.length - 1].value ?? 0) : (tSet[0].value ?? 0);
            }
            if (ref > 0) cardioRefIntensities[exId] = ref;
        });

        // 3. Process PLANNING
        let totalVolume = 0;
        let totalInternalLoadResisted = 0;
        let totalExternalLoadCardio = 0;
        let totalInternalLoadCardio = 0;
        let totalInternalLoadFlex = 0;
        
        const intensityMapResisted = new Map<string, Record<string, number>>();
        const intensityMapFlex = new Map<string, Record<string, number>>();

        const cardioZones = {
            'Supramáximo (>100%)': { time: 0, color: '#7F1D1D' },
            'Máximo (100%)': { time: 0, color: '#EF4444' },
            'Severo (85-99%)': { time: 0, color: '#F97316' },
            'Pesado (63-84%)': { time: 0, color: '#F59E0B' },
            'Moderado (45-62%)': { time: 0, color: '#10B981' },
            'Leve (<45%)': { time: 0, color: '#3B82F6' },
        };

        muscleGroups.forEach(m => {
            intensityMapResisted.set(m, { 'Alta (≥ 85% 1RM)': 0, 'Moderada (60-84% 1RM)': 0, 'Leve (30-59% 1RM)': 0, 'Muito Leve (< 30% 1RM)': 0, 'Indefinido': 0 });
            intensityMapFlex.set(m, { 'Alta': 0, 'Moderada': 0, 'Leve': 0, 'Muito Leve': 0 });
        });

        const intensityColors: Record<string, string> = {
            'Alta (≥ 85% 1RM)': '#DB2777',
            'Moderada (60-84% 1RM)': '#F59E0B',
            'Leve (30-59% 1RM)': '#10B981',
            'Muito Leve (< 30% 1RM)': '#3B82F6',
            'Indefinido': '#6B7280',
            'Alta': '#DB2777',
            'Moderada': '#F59E0B',
            'Leve': '#10B981',
            'Muito Leve': '#3B82F6'
        };

        for (const routine of analyzedRoutines) {
            for (const plannedEx of routine.plannedExercises) {
                const exercise = exercises.find(e => e.id === plannedEx.exerciseId);
                if (!exercise) continue;

                const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);
                const max1RM = max1RMMap.get(exercise.id);
                const cardioRef = cardioRefIntensities[exercise.id];

                for (const set of plannedEx.sets) {
                    const effort = parseEffortToNumber(set.effort);
                    
                    if (exercise.category === ExerciseCategory.RESISTED) {
                        // Carga Interna soma o esforço se houver esforço definido
                        if (effort > 0) {
                            totalInternalLoadResisted += effort;
                        }

                        if (effort >= 7) {
                            const avgReps = getAverageReps(set);
                            if (exercise.unit === Unit.KG) {
                                const setValue = (set.value ?? 0) + (plannedEx.barbellWeight ?? 0);
                                let calculatedLoad;
                                if (exercise.isCounterweight && latestBodyMass && setValue > 0) calculatedLoad = Math.max(0, latestBodyMass - setValue);
                                else calculatedLoad = exercise.isWeightDoubled ? (setValue * 2) : setValue;
                                
                                if (avgReps > 0 && calculatedLoad > 0) {
                                    totalVolume += avgReps * calculatedLoad;
                                }

                                let intensityCategory = 'Indefinido';
                                if (max1RM && max1RM > 0) {
                                    const percentage = (calculatedLoad / max1RM) * 100;
                                    if (percentage >= 85) intensityCategory = 'Alta (≥ 85% 1RM)';
                                    else if (percentage >= 60) intensityCategory = 'Moderada (60-84% 1RM)';
                                    else if (percentage >= 30) intensityCategory = 'Leve (30-59% 1RM)';
                                    else intensityCategory = 'Muito Leve (< 30% 1RM)';
                                }

                                uniqueMuscles.forEach(m => {
                                    if (intensityMapResisted.has(m)) intensityMapResisted.get(m)![intensityCategory]++;
                                });
                            }
                        }
                    } else if (exercise.category === ExerciseCategory.CARDIO) {
                        const timeInSeconds = set.time ?? 0;
                        const timeInMinutes = timeInSeconds / 60;
                        const value = set.value ?? 0;
                        
                        if (effort > 0) {
                            totalInternalLoadCardio += effort;
                        }

                        if (timeInMinutes > 0) {
                            if (value > 0) totalExternalLoadCardio += timeInMinutes * value;

                            if (cardioRef && value > 0) {
                                const percentage = (value / cardioRef) * 100;
                                let zoneKey: keyof typeof cardioZones;
                                if (percentage > 100) zoneKey = 'Supramáximo (>100%)';
                                else if (percentage >= 100) zoneKey = 'Máximo (100%)';
                                else if (percentage >= 85) zoneKey = 'Severo (85-99%)';
                                else if (percentage >= 63) zoneKey = 'Pesado (63-84%)';
                                else if (percentage >= 45) zoneKey = 'Moderado (45-62%)';
                                else zoneKey = 'Leve (<45%)';
                                cardioZones[zoneKey].time += timeInSeconds;
                            }
                        }
                    } else if (exercise.category === ExerciseCategory.FLEXIBILITY) {
                        if (effort > 0) {
                            totalInternalLoadFlex += effort;
                        }

                        let intensityCategory = 'Moderada';
                        if (effort >= 7) intensityCategory = 'Alta';
                        else if (effort >= 4) intensityCategory = 'Moderada';
                        else if (effort >= 2) intensityCategory = 'Leve';
                        else intensityCategory = 'Muito Leve';

                        uniqueMuscles.forEach(m => {
                            if (intensityMapFlex.has(m)) intensityMapFlex.get(m)![intensityCategory]++;
                        });
                    }
                }
            }
        }
        
        const resistedChartData: ChartData[] = Array.from(intensityMapResisted.entries())
            .map(([muscle, counts]) => {
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                const details = Object.entries(counts).filter(([, val]) => val > 0).map(([name, value]) => ({ name, value, color: intensityColors[name] }));
                return { label: muscle, value: total, details };
            })
            .filter(item => item.value > 0);

        const flexibilityChartData: ChartData[] = Array.from(intensityMapFlex.entries())
            .map(([muscle, counts]) => {
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                const details = Object.entries(counts).filter(([, val]) => val > 0).map(([name, value]) => ({ name, value, color: intensityColors[name] }));
                return { label: muscle, value: total, details };
            })
            .filter(item => item.value > 0);

        const cardioChartData: ChartData[] = Object.entries(cardioZones).map(([label, data]) => ({
            label,
            value: Math.round(data.time / 60),
            details: [{ name: 'Duração', value: Math.round(data.time / 60), color: data.color }]
        }));

        return {
            totalVolume: Math.round(totalVolume),
            totalInternalLoadResisted: totalInternalLoadResisted,
            totalExternalLoadCardio: Math.round(totalExternalLoadCardio),
            totalInternalLoadCardio: totalInternalLoadCardio,
            totalInternalLoadFlex: totalInternalLoadFlex,
            seriesByMuscleResisted: resistedChartData,
            seriesByMuscleFlex: flexibilityChartData,
            cardioIntensityDistribution: cardioChartData
        };

    }, [analyzedRoutines, exercises, muscleGroups, evaluations, workouts, selectedReferences]);

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        const footer = document.getElementById('stats-modal-footer');
        const captureArea = document.getElementById('stats-capture-area');
        const scrollContent = document.getElementById('stats-scroll-content');

        if (!captureArea || !scrollContent) {
            console.error("Capture area or scroll content not found!");
            setIsGeneratingPdf(false);
            return;
        }

        if (footer) footer.style.display = 'none';
        const originalCaptureMaxHeight = captureArea.style.maxHeight;
        const originalScrollOverflow = scrollContent.style.overflow;
        captureArea.style.maxHeight = 'none';
        scrollContent.style.overflow = 'visible';
        scrollContent.style.height = 'auto';

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const { jsPDF } = (window as any).jspdf;
            const html2canvas = (window as any).html2canvas;
            
            if (!jsPDF || !html2canvas) throw new Error("PDF libraries not found.");

            const backgroundColor = window.getComputedStyle(captureArea).backgroundColor;

            const canvas = await html2canvas(captureArea, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor,
                height: captureArea.scrollHeight,
                windowHeight: captureArea.scrollHeight,
            });

            const imgData = canvas.toDataURL('image/png');
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const pdf = new jsPDF({
                orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvasWidth, canvasHeight],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvasWidth, canvasHeight);
            const filename = `Relatorio_Planejado_${title.replace(/\s+/g, '_')}.pdf`;
            const pdfBlob = pdf.output('blob');
            await shareFile(filename, pdfBlob, 'application/pdf');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
        } finally {
            if (footer) footer.style.display = 'block';
            captureArea.style.maxHeight = originalCaptureMaxHeight;
            scrollContent.style.overflow = originalScrollOverflow;
            setIsGeneratingPdf(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div id="stats-capture-area" className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col text-light-text dark:text-dark-text shadow-2xl">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center">
                        <BarChartIcon className="h-6 w-6 mr-3 text-primary" />
                        {title}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div id="stats-scroll-content" className="overflow-y-auto pr-2 space-y-8 pb-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
                        Estes dados são uma estimativa baseada nas rotinas planejadas e no seu histórico de força (1RM) registrado em treinos anteriores.
                    </p>
                    
                    {/* Resistido */}
                    <section>
                        <h4 className="text-lg font-bold mb-3 border-b border-light-border dark:border-dark-border pb-1">Resistido</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <StatCard title="Volume Total Planejado" value={stats.totalVolume.toLocaleString('pt-BR')} unit="Kg" />
                            <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Carga Interna Planejada</p>
                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{stats.totalInternalLoadResisted.toLocaleString('pt-BR')} <span className="text-lg font-medium">UA</span></p>
                                <p className="text-[10px] text-light-text-secondary mt-1">Soma do esforço (PSE) planejado</p>
                            </div>
                        </div>
                         <div>
                            <h5 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Séries Planejadas por Grupo Muscular (Intensidade por 1RM)</h5>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">Apenas séries com esforço ≥ 7.</p>
                            <HorizontalBarChart data={stats.seriesByMuscleResisted} unit="séries" legend={resistedLegend} verticalLegend={true} />
                        </div>
                    </section>

                    {/* Cardio */}
                    <section>
                        <h4 className="text-lg font-bold mb-3 border-b border-light-border dark:border-dark-border pb-1">Cardiovascular</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <StatCard title="Carga Externa Planejada" value={stats.totalExternalLoadCardio.toLocaleString('pt-BR')} unit="UA" />
                            <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Carga Interna Planejada</p>
                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{stats.totalInternalLoadCardio.toLocaleString('pt-BR')} <span className="text-lg font-medium">UA</span></p>
                                <p className="text-[10px] text-light-text-secondary mt-1">Soma do esforço (PSE) planejado</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h5 className="text-md font-semibold text-light-text dark:text-dark-text">Distribuição de Intensidade Planejada</h5>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4">Baseada nos exercícios de cardio planejados e seus testes de referência.</p>
                            
                            {cardioExercisesInRoutines.length > 0 ? (
                                <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg space-y-3 mb-6">
                                    <div className="flex items-center text-[10px] font-bold uppercase text-light-text-secondary mb-1">
                                        <SettingsIcon className="h-3 w-3 mr-1" /> Mapeamento de Referências (100%)
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {cardioExercisesInRoutines.map(ex => {
                                            const availableTests = availableTestsByExercise[ex.id] || [];
                                            return (
                                                <div key={ex.id} className="space-y-1">
                                                    <label className="block text-[10px] font-bold text-light-text dark:text-dark-text truncate">{ex.name}</label>
                                                    <CustomSelect 
                                                        options={availableTests}
                                                        value={selectedReferences[ex.id]}
                                                        onChange={(val) => setSelectedReferences(prev => ({ ...prev, [ex.id]: val || '' }))}
                                                        placeholder={availableTests.length > 0 ? "Escolha o teste..." : "Nenhum teste"}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-light-text-secondary italic">Nenhum exercício cardiovascular planejado.</p>
                            )}

                            {stats.cardioIntensityDistribution.some(i => i.value > 0) ? (
                                <div className="mt-4">
                                    <HorizontalBarChart data={stats.cardioIntensityDistribution} unit="min" sortData={false} />
                                    <div className="mt-6 flex gap-3 text-[9px] text-light-text-secondary justify-center flex-wrap">
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#7F1D1D'}}></span> Supramáximo (&gt;100%)</div>
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#EF4444'}}></span> Máximo (100%)</div>
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#F97316'}}></span> Severo (85-99%)</div>
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#F59E0B'}}></span> Pesado (63-84%)</div>
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#10B981'}}></span> Moderado (45-62%)</div>
                                        <div className="flex items-center"><span className="h-2 w-2 rounded-full mr-1" style={{backgroundColor: '#3B82F6'}}></span> Leve {"(<45%)"}</div>
                                    </div>
                                </div>
                            ) : cardioExercisesInRoutines.length > 0 && (
                                <p className="text-xs text-center p-4 border-2 border-dashed border-light-border dark:border-dark-border rounded-lg text-light-text-secondary">
                                    Selecione testes de referência acima para visualizar a distribuição de zonas.
                                </p>
                            )}
                        </div>
                    </section>

                    {/* Flexibilidade */}
                    <section>
                        <h4 className="text-lg font-bold mb-3 border-b border-light-border dark:border-dark-border pb-1">Flexibilidade</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Carga Interna Planejada</p>
                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{stats.totalInternalLoadFlex.toLocaleString('pt-BR')} <span className="text-lg font-medium">UA</span></p>
                                <p className="text-[10px] text-light-text-secondary mt-1">Soma do esforço (PERFLEX) planejado</p>
                            </div>
                        </div>
                         <div>
                            <h5 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Séries Planejadas por Grupo Muscular (Intensidade por PERFLEX)</h5>
                            <HorizontalBarChart data={stats.seriesByMuscleFlex} unit="séries" legend={flexibilityLegend} />
                        </div>
                    </section>
                </div>
                 <div id="stats-modal-footer" className="mt-auto pt-6 border-t border-light-border dark:border-dark-border flex-shrink-0">
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
            </div>
        </div>
    );
};

export default RoutinesStatsModal;
