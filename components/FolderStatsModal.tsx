import React, { useMemo, useState } from 'react';
import { Folder, Routine, Exercise, ExerciseCategory, Unit, MeasurementType, Evaluation } from '../types';
import { useApp } from '../App';
import { XIcon, BarChartIcon, FileTextIcon } from './Icons';
import { HorizontalBarChart, ChartData } from './Charts';
import { parseEffortToNumber, getAverageReps } from '../utils';

interface FolderStatsModalProps {
    folder: Folder;
    routines: Routine[];
    exercises: Exercise[];
    evaluations: Evaluation[];
    onClose: () => void;
}

const StatCard: React.FC<{ title: string; value: string; unit: string }> = ({ title, value, unit }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{value} <span className="text-lg font-medium">{unit}</span></p>
    </div>
);

const FolderStatsModal: React.FC<FolderStatsModalProps> = ({ folder, routines, exercises, evaluations, onClose }) => {
    const { muscleGroups } = useApp();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const folderStats = useMemo(() => {
        const routinesInFolder = routines.filter(r => r.folderId === folder.id);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;
        
        let totalVolume = 0;
        let totalInternalLoadResisted = 0;
        let totalExternalLoadCardio = 0;
        let totalInternalLoadCardio = 0;
        let totalInternalLoadFlex = 0;
        const seriesByMuscleResisted = new Map<string, number>();
        const seriesByMuscleFlex = new Map<string, number>();

        muscleGroups.forEach(m => {
            seriesByMuscleResisted.set(m, 0);
            seriesByMuscleFlex.set(m, 0);
        });

        for (const routine of routinesInFolder) {
            for (const plannedEx of routine.plannedExercises) {
                const exercise = exercises.find(e => e.id === plannedEx.exerciseId);
                if (!exercise) continue;

                const uniqueMuscles = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);

                for (const set of plannedEx.sets) {
                    const avgReps = getAverageReps(set);
                    const effort = parseEffortToNumber(set.effort);
                    
                    if (exercise.category === ExerciseCategory.RESISTED) {
                        if (exercise.unit === Unit.KG) {
                            const setValue = (set.value ?? 0) + (plannedEx.barbellWeight ?? 0);
                            let calculatedLoad;
        
                            if (exercise.isCounterweight && latestBodyMass && setValue > 0) {
                                calculatedLoad = Math.max(0, latestBodyMass - setValue);
                            } else {
                                calculatedLoad = exercise.isWeightDoubled ? (setValue * 2) : setValue;
                            }
                            
                            if (avgReps > 0 && calculatedLoad > 0) {
                                totalVolume += avgReps * calculatedLoad;
                                if (effort > 0) {
                                    totalInternalLoadResisted += avgReps * calculatedLoad * effort;
                                }
                            }
                        }
                        uniqueMuscles.forEach(m => {
                            seriesByMuscleResisted.set(m, (seriesByMuscleResisted.get(m) || 0) + 1);
                        });
                    } else if (exercise.category === ExerciseCategory.CARDIO) {
                        const timeInMinutes = (set.time ?? 0) / 60;
                        const value = set.value ?? 0;
                        if (timeInMinutes > 0) {
                            totalInternalLoadCardio += timeInMinutes * effort;
                            if (value > 0) {
                                totalExternalLoadCardio += timeInMinutes * value;
                            }
                        }
                    } else if (exercise.category === ExerciseCategory.FLEXIBILITY) {
                        const baseValue = exercise.measurementType === MeasurementType.TIME ? ((set.time ?? 0) / 60) : avgReps;
                        if (baseValue > 0) {
                            totalInternalLoadFlex += baseValue * effort;
                        }
                         uniqueMuscles.forEach(m => {
                            seriesByMuscleFlex.set(m, (seriesByMuscleFlex.get(m) || 0) + 1);
                        });
                    }
                }
            }
        }
        
        const mapToChartData = (map: Map<string, number>): ChartData[] => {
            return Array.from(map.entries())
                .filter(([, value]) => value > 0)
                .map(([label, value]) => ({ label, value }));
        };

        return {
            totalVolume: Math.round(totalVolume),
            totalInternalLoadResisted: Math.round(totalInternalLoadResisted),
            totalExternalLoadCardio: Math.round(totalExternalLoadCardio),
            totalInternalLoadCardio: Math.round(totalInternalLoadCardio),
            totalInternalLoadFlex: Math.round(totalInternalLoadFlex),
            seriesByMuscleResisted: mapToChartData(seriesByMuscleResisted),
            seriesByMuscleFlex: mapToChartData(seriesByMuscleFlex),
        };

    }, [folder, routines, exercises, muscleGroups, evaluations]);

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        const footer = document.getElementById('folder-stats-modal-footer');
        const captureArea = document.getElementById('folder-stats-capture-area');
        const scrollContent = document.getElementById('folder-stats-scroll-content');

        if (!captureArea || !scrollContent) {
            console.error("Capture area or scroll content not found!");
            setIsGeneratingPdf(false);
            return;
        }

        // Prepare for capture by hiding the button and expanding the content
        if (footer) footer.style.display = 'none';
        const originalCaptureMaxHeight = captureArea.style.maxHeight;
        const originalScrollOverflow = scrollContent.style.overflow;
        captureArea.style.maxHeight = 'none';
        scrollContent.style.overflow = 'visible';
        scrollContent.style.height = 'auto';

        // Allow DOM to update
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
                // These options are key to capturing the full scrollable content
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
            const filename = `Relatorio_Planejado_${folder.name.replace(/\s+/g, '_')}.pdf`;
            pdf.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
        } finally {
            // Restore original styles
            if (footer) footer.style.display = 'block';
            captureArea.style.maxHeight = originalCaptureMaxHeight;
            scrollContent.style.overflow = originalScrollOverflow;
            setIsGeneratingPdf(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div id="folder-stats-capture-area" className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center">
                        <BarChartIcon className="h-6 w-6 mr-3 text-primary" />
                        Estatísticas Planejadas: {folder.name}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div id="folder-stats-scroll-content" className="overflow-y-auto pr-2 space-y-6">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
                        Estes dados são uma estimativa baseada nas rotinas planejadas dentro desta pasta, não em treinos concluídos.
                    </p>
                    {/* Resistido */}
                    <section>
                        <h4 className="text-lg font-bold mb-3">Resistido</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <StatCard title="Volume Total Planejado" value={folderStats.totalVolume.toLocaleString('pt-BR')} unit="Kg" />
                            <StatCard title="Carga Interna Planejada" value={folderStats.totalInternalLoadResisted.toLocaleString('pt-BR')} unit="UA" />
                        </div>
                         <div>
                            <h5 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Séries Planejadas por Grupo Muscular</h5>
                            <HorizontalBarChart data={folderStats.seriesByMuscleResisted} unit="séries" />
                        </div>
                    </section>
                    <hr className="border-light-border dark:border-dark-border" />
                    {/* Cardio */}
                    <section>
                        <h4 className="text-lg font-bold mb-3">Cardiovascular</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <StatCard title="Carga Externa Planejada" value={folderStats.totalExternalLoadCardio.toLocaleString('pt-BR')} unit="UA" />
                            <StatCard title="Carga Interna Planejada" value={folderStats.totalInternalLoadCardio.toLocaleString('pt-BR')} unit="UA" />
                        </div>
                    </section>
                     <hr className="border-light-border dark:border-dark-border" />
                    {/* Flexibilidade */}
                    <section>
                        <h4 className="text-lg font-bold mb-3">Flexibilidade</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <StatCard title="Carga Interna Planejada" value={folderStats.totalInternalLoadFlex.toLocaleString('pt-BR')} unit="UA" />
                        </div>
                         <div>
                            <h5 className="text-md font-semibold text-light-text dark:text-dark-text mb-1">Séries Planejadas por Grupo Muscular</h5>
                            <HorizontalBarChart data={folderStats.seriesByMuscleFlex} unit="séries" />
                        </div>
                    </section>
                </div>
                 <div id="folder-stats-modal-footer" className="mt-auto pt-6 border-t border-light-border dark:border-dark-border flex-shrink-0">
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

export default FolderStatsModal;