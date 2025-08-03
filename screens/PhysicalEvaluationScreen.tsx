

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { Evaluation } from '../types';
import { XIcon, PlusIcon, ClipboardListIcon, ChevronDownIcon } from '../components/Icons';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';
import { calculateAllBodyComposition, BodyFatAuthor } from '../utils';
import { LineChart, LineChartDataset } from '../components/Charts';


// Accordion Section Component
interface AccordionSectionProps {
    title: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children, isOpen, onToggle }) => {
    return (
        <div className="bg-light-card dark:bg-dark-card rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center p-4"
                aria-expanded={isOpen}
            >
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h3>
                <ChevronDownIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 border-t border-light-border dark:border-dark-border">
                    {children}
                </div>
            )}
        </div>
    );
};


const PhysicalEvaluationScreen: React.FC = () => {
    const { 
        setIsMeasurementsScreenOpen, 
        setIsPhysicalEvaluationScreenOpen,
        evaluations,
        setSelectedEvaluationDate 
    } = useApp();

    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    // State for the main evaluation selector
    const [currentDate, setCurrentDate] = useState<string | undefined>(
        () => (evaluations && evaluations.length > 0 ? evaluations[0].date : undefined)
    );

    // State for chart selections
    const [selectedDatesForChart, setSelectedDatesForChart] = useState<string[]>(
        () => evaluations.map(e => e.date).slice(0, 5) // Default to showing the last 5 evaluations
    );
    const [chartFatFormulaAuthor, setChartFatFormulaAuthor] = useState<string>(BodyFatAuthor.PETROSKI);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['bodyMass']);
    const [selectedPercentageMetrics, setSelectedPercentageMetrics] = useState<string[]>(['fatPercentage']);

    const metricOptions = [
        { id: 'bodyMass', label: 'Massa Corporal', color: '#3B82F6' },
        { id: 'fatMass', label: 'Massa Gorda', color: '#EF4444' },
        { id: 'muscleWeight', label: 'Massa Muscular', color: '#22C55E' },
        { id: 'boneWeight', label: 'Massa Óssea', color: '#F97316' },
        { id: 'residualWeight', label: 'Massa Residual', color: '#8B5CF6' },
    ];
    
    const percentageMetricOptions = [
        { id: 'fatPercentage', label: '% Massa Gorda', color: '#EF4444' },
        { id: 'musclePercentage', label: '% Massa Muscular', color: '#22C55E' },
        { id: 'bonePercentage', label: '% Massa Óssea', color: '#F97316' },
        { id: 'residualPercentage', label: '% Massa Residual', color: '#8B5CF6' },
    ];
    

    // This effect ensures that if the selected evaluation is deleted,
    // the state updates to the new latest evaluation or clears.
    useEffect(() => {
        const currentEvaluationExists = evaluations.some(e => e.date === currentDate);
        if (!currentEvaluationExists) {
            setCurrentDate(evaluations.length > 0 ? evaluations[0].date : undefined);
        }
        // Also update chart selections if evaluations change
        setSelectedDatesForChart(current => current.filter(date => evaluations.some(e => e.date === date)));

    }, [evaluations]);

    const evaluationOptions: CustomSelectOption[] = useMemo(() => 
        evaluations.map((ev: Evaluation) => ({
            value: ev.date,
            label: new Date(`${ev.date}T00:00:00`).toLocaleDateString('pt-BR', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
        })), [evaluations]
    );

    const chartData = useMemo<LineChartDataset[]>(() => {
        const sortedSelectedDates = [...selectedDatesForChart].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        const calculatedData = sortedSelectedDates.map(date => {
            const evaluation = evaluations.find(e => e.date === date);
            if (!evaluation) return null;
            return {
                date,
                metrics: calculateAllBodyComposition(evaluation.measurements, chartFatFormulaAuthor)
            };
        }).filter(d => d !== null);

        return metricOptions
            .filter(opt => selectedMetrics.includes(opt.id))
            .map(metric => ({
                label: metric.label,
                color: metric.color,
                data: calculatedData.map(d => d ? (d.metrics as any)[metric.id] : null)
            }));
    }, [evaluations, selectedDatesForChart, chartFatFormulaAuthor, selectedMetrics]);
    
    const percentageChartData = useMemo<LineChartDataset[]>(() => {
        const sortedSelectedDates = [...selectedDatesForChart].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
        const calculatedData = sortedSelectedDates.map(date => {
            const evaluation = evaluations.find(e => e.date === date);
            if (!evaluation || !evaluation.measurements.bodyMass) return null;
    
            const bodyMass = evaluation.measurements.bodyMass;
            const composition = calculateAllBodyComposition(evaluation.measurements, chartFatFormulaAuthor);
    
            return {
                date,
                metrics: {
                    fatPercentage: composition.fatPercentage,
                    musclePercentage: composition.muscleWeight ? (composition.muscleWeight / bodyMass) * 100 : null,
                    bonePercentage: composition.boneWeight ? (composition.boneWeight / bodyMass) * 100 : null,
                    residualPercentage: composition.residualWeight ? (composition.residualWeight / bodyMass) * 100 : null,
                }
            };
        }).filter(d => d !== null);
    
        return percentageMetricOptions
            .filter(opt => selectedPercentageMetrics.includes(opt.id))
            .map(metric => ({
                label: metric.label,
                color: metric.color,
                data: calculatedData.map(d => d ? (d.metrics as any)[metric.id] : null)
            }));
    }, [evaluations, selectedDatesForChart, chartFatFormulaAuthor, selectedPercentageMetrics]);


    const handleEditMeasurements = () => {
        if (currentDate) {
            setSelectedEvaluationDate(currentDate);
            setIsMeasurementsScreenOpen(true);
            setIsPhysicalEvaluationScreenOpen(false);
        } else if (evaluations.length > 0) {
            alert('Por favor, selecione uma avaliação para editar.');
        } else {
            handleNewMeasurement();
        }
    };

    const handleNewMeasurement = () => {
        setSelectedEvaluationDate(null);
        setIsMeasurementsScreenOpen(true);
        setIsPhysicalEvaluationScreenOpen(false);
    };

    const toggleChartDate = (date: string) => {
        setSelectedDatesForChart(current =>
            current.includes(date) ? current.filter(d => d !== date) : [...current, date]
        );
    };
    
    const toggleChartMetric = (metricId: string) => {
        setSelectedMetrics(current =>
            current.includes(metricId) ? current.filter(m => m !== metricId) : [...current, metricId]
        );
    };
    
    const toggleChartPercentageMetric = (metricId: string) => {
        setSelectedPercentageMetrics(current =>
            current.includes(metricId) ? current.filter(m => m !== metricId) : [...current, metricId]
        );
    };

    const onClose = () => {
        setIsPhysicalEvaluationScreenOpen(false);
    };

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding border-b border-light-border dark:border-dark-border">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Avaliação Física</h2>
                <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                    <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
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
                
                <AccordionSection title="Histórico da Composição Corporal" isOpen={isHistoryOpen} onToggle={() => setIsHistoryOpen(v => !v)}>
                    <div className="space-y-6">
                         {/* Common Selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium mb-1">Avaliações no Gráfico (Eixo X)</label>
                                <div className="p-2 rounded-md bg-light-bg dark:bg-dark-bg max-h-48 overflow-y-auto space-y-1">
                                    {evaluationOptions.length > 0 ? evaluationOptions.map(ev => (
                                        <label key={ev.value} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-light-card dark:hover:bg-dark-card">
                                            <input
                                                type="checkbox"
                                                checked={selectedDatesForChart.includes(ev.value)}
                                                onChange={() => toggleChartDate(ev.value)}
                                                className="h-4 w-4 rounded text-primary bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium text-light-text dark:text-dark-text">{ev.label}</span>
                                        </label>
                                    )) : <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary p-4">Nenhuma avaliação encontrada.</p>}
                                </div>
                            </div>
                            <div>
                                 <label htmlFor="fatAuthorSelectChart" className="block text-sm font-medium mb-1">Fórmula de Gordura Corporal</label>
                                 <CustomSelect
                                     id="fatAuthorSelectChart"
                                     options={Object.values(BodyFatAuthor).map(author => ({ value: author, label: author }))}
                                     value={chartFatFormulaAuthor}
                                     onChange={(val) => setChartFatFormulaAuthor(val as string)}
                                     allowDeselect={false}
                                 />
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Esta fórmula afeta o cálculo de Massa Gorda e Massa Muscular nos gráficos.</p>
                            </div>
                        </div>

                        {/* Absolute Value Chart */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">Gráfico Absoluto (kg)</h4>
                                <label className="block text-sm font-medium mb-1">Métricas a Exibir (Eixo Y)</label>
                                <div className="p-2 rounded-md bg-light-bg dark:bg-dark-bg space-y-1">
                                    {metricOptions.map(metric => (
                                        <label key={metric.id} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-light-card dark:hover:bg-dark-card">
                                            <input
                                                type="checkbox"
                                                checked={selectedMetrics.includes(metric.id)}
                                                onChange={() => toggleChartMetric(metric.id)}
                                                className="h-4 w-4 rounded text-primary bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border focus:ring-primary"
                                                style={{ accentColor: metric.color }}
                                            />
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: metric.color }}></span>
                                            <span className="text-sm font-medium text-light-text dark:text-dark-text">{metric.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                           
                            <div className="mt-4">
                                 <LineChart 
                                    datasets={chartData}
                                    labels={selectedDatesForChart.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map(d => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}
                                    unit="kg"
                                 />
                            </div>
                        </div>
                        
                        <hr className="border-light-border dark:border-dark-border my-6" />

                        {/* Percentage Chart */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">Gráfico Percentual (%)</h4>
                                <label className="block text-sm font-medium mb-1">Métricas a Exibir (Eixo Y)</label>
                                <div className="p-2 rounded-md bg-light-bg dark:bg-dark-bg space-y-1">
                                    {percentageMetricOptions.map(metric => (
                                        <label key={metric.id} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-light-card dark:hover:bg-dark-card">
                                            <input
                                                type="checkbox"
                                                checked={selectedPercentageMetrics.includes(metric.id)}
                                                onChange={() => toggleChartPercentageMetric(metric.id)}
                                                className="h-4 w-4 rounded text-primary bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border focus:ring-primary"
                                                style={{ accentColor: metric.color }}
                                            />
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: metric.color }}></span>
                                            <span className="text-sm font-medium text-light-text dark:text-dark-text">{metric.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4">
                                 <LineChart 
                                    datasets={percentageChartData}
                                    labels={selectedDatesForChart.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map(d => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}
                                    unit="%"
                                 />
                            </div>
                        </div>

                    </div>
                </AccordionSection>
            </main>
        </div>
    );
};

export default PhysicalEvaluationScreen;
