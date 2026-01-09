import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, Unit, ExerciseCategory, WorkoutSession } from '../types';
import { XIcon, ChevronDownIcon, SearchIcon, DumbbellIcon, HeartPulseIcon, CalendarIcon } from '../components/Icons';
import { BarChart, ChartData } from '../components/Charts';
import { parseEffortToNumber, formatSecondsToMMSS } from '../utils';

// Helper to format a date to 'YYYY-MM-DD'
const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const repEstimationTableData = [
    { percentage: 100, reps: '1' },
    { percentage: 95, reps: '2' },
    { percentage: 90, reps: '3 a 4' },
    { percentage: 85, reps: '5 a 6' },
    { percentage: 80, reps: '7 a 8' },
    { percentage: 75, reps: '9 a 10' },
    { percentage: 70, reps: '11 a 12' },
];

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
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text text-left">{title}</h3>
                <ChevronDownIcon className={`h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 border-t border-light-border dark:border-dark-border">
                    {children}
                </div>
            )}
        </div>
    );
};


interface ExercisePickerModalProps {
    onClose: () => void;
    onSelect: (exercise: Exercise) => void;
    allExercises: Exercise[];
    categoryFilter?: ExerciseCategory;
}

const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ onClose, onSelect, allExercises, categoryFilter = ExerciseCategory.RESISTED }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExercises = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list = allExercises.filter(ex => ex.category === categoryFilter);
        
        // Additional filter for resisted 1RM tests
        if (categoryFilter === ExerciseCategory.RESISTED) {
            list = list.filter(ex => ex.unit === Unit.KG);
        }

        if (!query) return list;
        return list.filter(ex => ex.name.toLowerCase().includes(query));
    }, [allExercises, searchQuery, categoryFilter]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col text-light-text dark:text-dark-text">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold">Selecionar Exercício</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg"><XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" /></button>
                </div>
                <div className="relative mb-4 flex-shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg py-2 pl-10 pr-4"
                        autoFocus
                    />
                </div>
                <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                    {filteredExercises.length > 0 ? filteredExercises.map(ex => (
                        <button
                            key={ex.id}
                            onClick={() => onSelect(ex)}
                            className="w-full text-left p-2 rounded-md flex items-center gap-3 hover:bg-light-bg dark:hover:bg-dark-bg"
                        >
                            <div className="w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-md flex-shrink-0 flex items-center justify-center">
                                {ex.imageUrl ? (
                                    <img src={ex.imageUrl} alt={ex.name} className="w-full h-full object-cover rounded-md" loading="lazy" />
                                ) : (
                                    categoryFilter === ExerciseCategory.RESISTED ? 
                                        <DumbbellIcon className="h-6 w-6 text-light-text-secondary" /> : 
                                        <HeartPulseIcon className="h-6 w-6 text-light-text-secondary" />
                                )}
                            </div>
                            <span className="flex-grow">{ex.name}</span>
                        </button>
                    )) : (
                        <div className="text-center py-10 text-light-text-secondary dark:text-dark-text-secondary">
                            Nenhum exercício encontrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const PhysicalTestsScreen: React.FC = () => {
    const { 
        setIsPhysicalTestsScreenOpen,
        exercises,
        workouts,
        routines,
        evaluations,
        startFiveMinTest,
        startIncrementalTest,
        startOneRMTest
    } = useApp();

    const [isEstimationOpen, setIsEstimationOpen] = useState(true);
    const [isReal1rmOpen, setIsReal1rmOpen] = useState(false);
    const [isFiveMinTestOpen, setIsFiveMinTestOpen] = useState(false);
    const [isIncrementalTestOpen, setIsIncrementalTestOpen] = useState(false);

    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'estimation' | 'real1rm' | '5min' | 'incremental'>('estimation');
    
    // Date filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selected1RMForTable, setSelected1RMForTable] = useState<number | null>(null);

    const onClose = () => {
        setIsPhysicalTestsScreenOpen(false);
    };

    const oneRmStats = useMemo(() => {
        if (!selectedExercise || (pickerTarget !== 'estimation' && pickerTarget !== 'real1rm')) return { history: [], highest1RM: null, bestSet: null };

        const completedWorkouts = workouts.filter((w: any) => w.completed && w.date);
        const latestBodyMass = (evaluations && evaluations.length > 0) ? evaluations[0].measurements.bodyMass : undefined;

        const calculate1RM = (reps: number, load: number) => {
            if (reps <= 0 || load <= 0) return 0;
            if (reps === 1) return load;
            return load * (1 + reps / 30);
        };

        const dailyMax1RMs = new Map<string, { max1RM: number; routineId: string }>();
        let overallHighest1RM = 0;
        let bestSetForOverallHighest1RM: { reps: number; weight: number } | null = null;

        for (const session of completedWorkouts) {
            let sessionMax1RM = 0;
            for (const loggedEx of session.loggedExercises) {
                if (loggedEx.exerciseId === selectedExercise.id) {
                    for (const set of loggedEx.sets) {
                        const effortValue = parseEffortToNumber(set.effort);
                        
                        // For real 1RM, we might only want to look at sets where reps === 1
                        if (pickerTarget === 'real1rm' && set.reps !== 1) continue;
                        
                        // For estimation, we only look at high effort sets
                        if (pickerTarget === 'estimation' && effortValue < 9.5) continue;

                        const reps = set.reps ?? 0;
                        const setWeight = set.value ?? 0;
                        const barbellWeight = loggedEx.barbellWeight ?? 0;
                        let totalLoad = setWeight + barbellWeight;
                        if (selectedExercise.isWeightDoubled) totalLoad *= 2;
                        else if (selectedExercise.isCounterweight && latestBodyMass && totalLoad > 0) totalLoad = Math.max(0, latestBodyMass - totalLoad);

                        const current1RM = calculate1RM(reps, totalLoad);
                        
                        if (current1RM > sessionMax1RM) {
                            sessionMax1RM = current1RM;
                        }

                        if (current1RM > overallHighest1RM) {
                            overallHighest1RM = current1RM;
                            bestSetForOverallHighest1RM = { reps, weight: totalLoad };
                        }
                    }
                }
            }
            if (sessionMax1RM > 0) {
                const dateKey = session.date;
                const existingEntry = dailyMax1RMs.get(dateKey);
                if (!existingEntry || sessionMax1RM > existingEntry.max1RM) {
                    dailyMax1RMs.set(dateKey, { max1RM: sessionMax1RM, routineId: session.routineId });
                }
            }
        }

        const history: (ChartData & { date: string })[] = Array.from(dailyMax1RMs.entries())
            .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
            .map(([date, data]) => {
                const routine = routines.find((r: any) => r.id === data.routineId);
                const rounded1RM = Math.round(data.max1RM);
                return {
                    label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    value: rounded1RM,
                    details: [{ name: routine?.name || 'Rotina Desconhecida', value: rounded1RM, color: routine?.color || '#808080' }],
                    date,
                };
            });
        
        const highest1RM = overallHighest1RM > 0 ? { value: Math.round(overallHighest1RM) } : null;

        return { history, highest1RM, bestSet: bestSetForOverallHighest1RM };

    }, [selectedExercise, workouts, routines, evaluations, pickerTarget]);

    // Cardiovascular history detection
    const cardioTestsHistory = useMemo(() => {
        if (!selectedExercise || (pickerTarget !== '5min' && pickerTarget !== 'incremental')) return [];

        const protocolKey = pickerTarget === '5min' ? '5 minutos' : 'Incremental';
        
        return workouts.filter((w: WorkoutSession) => {
            if (!w.completed || w.routineId !== 'internal_test') return false;
            const testExercise = w.loggedExercises[0];
            if (testExercise?.exerciseId !== selectedExercise.id) return false;
            return testExercise.notes?.includes(protocolKey);
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [workouts, selectedExercise, pickerTarget]);

    // Real 1RM history (only where routineId is internal_test and reps == 1)
    const real1rmHistory = useMemo(() => {
        if (!selectedExercise || pickerTarget !== 'real1rm') return [];

        return workouts.filter((w: WorkoutSession) => {
            if (!w.completed || w.routineId !== 'internal_test') return false;
            const testExercise = w.loggedExercises[0];
            if (testExercise?.exerciseId !== selectedExercise.id) return false;
            return testExercise.notes?.includes('Teste de 1RM Real');
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [workouts, selectedExercise, pickerTarget]);

    const { history: oneRmHistory, highest1RM, bestSet } = oneRmStats;

    // Effect to set initial date range and table 1RM
    useEffect(() => {
        if (oneRmHistory.length > 0) {
            const endDate = oneRmHistory[oneRmHistory.length - 1].date;
            const startIndex = Math.max(0, oneRmHistory.length - 4);
            const startDate = oneRmHistory[startIndex].date;
            
            setStartDate(startDate);
            setEndDate(endDate);
        } else {
             setStartDate('');
             setEndDate('');
        }

        if (highest1RM) {
            setSelected1RMForTable(highest1RM.value);
        } else {
            setSelected1RMForTable(null);
        }
    }, [oneRmHistory, highest1RM]);

    // Logic to filter history by date
    const filteredHistoryData = useMemo(() => {
        if (!startDate || !endDate || !oneRmHistory) return [];
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        return oneRmHistory.filter(item => {
            const itemDate = new Date(`${item.date}T00:00:00`);
            return itemDate >= start && itemDate <= end;
        });
    }, [startDate, endDate, oneRmHistory]);

    const handleOpenPicker = (target: 'estimation' | 'real1rm' | '5min' | 'incremental') => {
        setPickerTarget(target);
        setIsExercisePickerOpen(true);
    };

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding border-b border-light-border dark:border-dark-border">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Testes Físicos</h2>
                <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                    <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
            </header>
            <main className="flex-grow overflow-y-auto overflow-x-auto p-4 md:p-6 space-y-6">
                <div className="inline-block min-w-full space-y-4">
                    <AccordionSection title="Estimativa de 1RM (Repetições Múltiplas)" isOpen={isEstimationOpen} onToggle={() => setIsEstimationOpen(v => !v)}>
                        <div className="space-y-4">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                Projeção de carga máxima baseada em séries de alta intensidade realizadas nos treinos regulares.
                            </p>
                            <div>
                                <label className="block text-sm font-medium mb-1">Exercício</label>
                                <button
                                    onClick={() => handleOpenPicker('estimation')}
                                    className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left"
                                >
                                    <span className={selectedExercise && pickerTarget === 'estimation' ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                        {(selectedExercise && pickerTarget === 'estimation') ? selectedExercise.name : 'Selecione um exercício...'}
                                    </span>
                                    <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                </button>
                            </div>
                            {selectedExercise && pickerTarget === 'estimation' && (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                                        <div>
                                            <label htmlFor="startDate" className="block text-xs font-medium mb-1">De:</label>
                                            <input
                                                type="date"
                                                id="startDate"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                                                max={endDate}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="endDate" className="block text-xs font-medium mb-1">Até:</label>
                                            <input
                                                type="date"
                                                id="endDate"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-sm"
                                                min={startDate}
                                                max={formatDateForInput(new Date())}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        *Cálculo baseado em séries com esforço (PSE/RIR) igual ou superior a 9.5.
                                    </div>
                                    <div className="h-72 pt-8 pl-4 pr-2">
                                        <BarChart data={filteredHistoryData} unit="kg" />
                                    </div>

                                    {highest1RM && bestSet && (
                                        <div className="mt-8 border-t border-light-border dark:border-dark-border pt-6 space-y-4">
                                            <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                                <p className="text-sm font-semibold text-light-text dark:text-dark-text">Maior Estimativa de 1 Repetição Máxima (1RM) já registrada</p>
                                                <p className="text-4xl font-bold text-primary">{highest1RM.value}<span className="text-2xl font-medium"> kg</span></p>
                                            </div>
                                            
                                            <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
                                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Baseado no registro de</p>
                                                <p className="text-2xl font-bold text-secondary">{bestSet.weight.toFixed(1)}kg <span className="font-normal">para</span> {bestSet.reps} reps</p>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <label htmlFor="1rm-selector-test" className="block text-sm font-medium mb-1">Basear estimativa no 1RM de:</label>
                                                <select
                                                    id="1rm-selector-test"
                                                    value={selected1RMForTable ?? ''}
                                                    onChange={(e) => setSelected1RMForTable(Number(e.target.value))}
                                                    className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2"
                                                >
                                                    <option value={highest1RM.value}>
                                                        Maior Registrado: {highest1RM.value} kg
                                                    </option>
                                                    {oneRmHistory.slice().reverse().map((record, index) => (
                                                        <option key={`${record.date}-${index}`} value={record.value}>
                                                            {record.label}: {record.value} kg
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {selected1RMForTable && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                                                        <thead className="text-xs text-light-text dark:text-dark-text uppercase bg-light-bg dark:bg-dark-bg">
                                                            <tr>
                                                                <th scope="col" className="px-4 py-2">% 1RM</th>
                                                                <th scope="col" className="px-4 py-2">Carga (kg)</th>
                                                                <th scope="col" className="px-4 py-2">Repetições Permitidas</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {repEstimationTableData.map(row => {
                                                                const calculatedLoad = (row.percentage / 100) * selected1RMForTable;
                                                                return (
                                                                    <tr key={row.percentage} className="border-b border-light-border dark:border-dark-border last:border-b-0">
                                                                        <td className="px-4 py-2 font-medium text-light-text dark:text-dark-text">{row.percentage}%</td>
                                                                        <td className="px-4 py-2">{calculatedLoad.toFixed(1)}</td>
                                                                        <td className="px-4 py-2">{row.reps}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </AccordionSection>

                    <AccordionSection title="Teste de 1RM Real (Protocolo de Carga Máxima)" isOpen={isReal1rmOpen} onToggle={() => setIsReal1rmOpen(v => !v)}>
                        <div className="space-y-4">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-justify">
                                Determinação direta da força máxima dinâmica. O teste consiste em encontrar a carga mais pesada que pode ser deslocada em uma única repetição técnica perfeita. Requer aquecimento progressivo e supervisão.
                            </p>
                            <div>
                                <label className="block text-sm font-medium mb-1">Exercício Resistido</label>
                                <button
                                    onClick={() => handleOpenPicker('real1rm')}
                                    className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left"
                                >
                                    <span className={selectedExercise && pickerTarget === 'real1rm' ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                        {(selectedExercise && pickerTarget === 'real1rm') ? selectedExercise.name : 'Selecione um exercício resistido...'}
                                    </span>
                                    <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                </button>
                            </div>
                            {selectedExercise && pickerTarget === 'real1rm' && (
                                <>
                                    <button
                                        onClick={() => startOneRMTest(selectedExercise.id)}
                                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-md flex items-center justify-center transition-colors shadow-lg"
                                    >
                                        Iniciar Protocolo de 1RM Real
                                    </button>

                                    {real1rmHistory.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-bold text-light-text dark:text-dark-text mb-3 uppercase tracking-wider flex items-center">
                                                <CalendarIcon className="h-4 w-4 mr-2" /> Histórico de Testes Reais
                                            </h4>
                                            <div className="space-y-2">
                                                {real1rmHistory.map(test => {
                                                    const sets = test.loggedExercises[0].sets;
                                                    const maxSet = sets.reduce((prev, curr) => 
                                                        (curr.reps === 1 && (curr.value ?? 0) > (prev.value ?? 0)) ? curr : prev, { value: 0, reps: 0 });
                                                    
                                                    return (
                                                        <div key={test.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex justify-between items-center border border-light-border dark:border-dark-border">
                                                            <div>
                                                                <p className="text-sm font-bold">{new Date(`${test.date}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                                                                <p className="text-xs text-light-text-secondary">{selectedExercise.name}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-primary">{maxSet.value ?? '-'} <span className="text-xs font-normal">kg</span></p>
                                                                <p className="text-[10px] text-light-text-secondary">Reps: 1</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </AccordionSection>

                    <AccordionSection title="Teste de 5 minutos (Cardio)" isOpen={isFiveMinTestOpen} onToggle={() => setIsFiveMinTestOpen(v => !v)}>
                        <div className="space-y-4">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-justify">
                                Protocolo para estimativa do limiar anaeróbio através do desempenho em 5 minutos. Pode ser realizado em intensidade máxima constante (velocidade/potência) para medir a distância total percorrida ou tempo de sustentação.
                            </p>
                            <div>
                                <label className="block text-sm font-medium mb-1">Exercício Cardiovascular</label>
                                <button
                                    onClick={() => handleOpenPicker('5min')}
                                    className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left"
                                >
                                    <span className={selectedExercise && pickerTarget === '5min' ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                        {(selectedExercise && pickerTarget === '5min') ? selectedExercise.name : 'Selecione um exercício cardio...'}
                                    </span>
                                    <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                </button>
                            </div>
                            {selectedExercise && pickerTarget === '5min' && (
                                <>
                                    <button
                                        onClick={() => startFiveMinTest(selectedExercise.id)}
                                        className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center transition-colors shadow-lg"
                                    >
                                        Iniciar Teste de 5 Minutos
                                    </button>

                                    {cardioTestsHistory.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-bold text-light-text dark:text-dark-text mb-3 uppercase tracking-wider flex items-center">
                                                <CalendarIcon className="h-4 w-4 mr-2" /> Histórico do Teste
                                            </h4>
                                            <div className="space-y-2">
                                                {cardioTestsHistory.map(test => {
                                                    const result = test.loggedExercises[0].sets[0];
                                                    return (
                                                        <div key={test.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex justify-between items-center border border-light-border dark:border-dark-border">
                                                            <div>
                                                                <p className="text-sm font-bold">{new Date(`${test.date}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                                                                <p className="text-xs text-light-text-secondary">{selectedExercise.name}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-secondary">{result.value ?? '-'} <span className="text-xs font-normal">{selectedExercise.unit}</span></p>
                                                                <p className="text-[10px] text-light-text-secondary">Duração: 05:00</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </AccordionSection>

                    <AccordionSection title="Teste Incremental (Cardio)" isOpen={isIncrementalTestOpen} onToggle={() => setIsIncrementalTestOpen(v => !v)}>
                        <div className="space-y-4">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-justify">
                                Teste progressivo para determinação da capacidade aeróbia máxima e frequência cardíaca máxima. A intensidade deve aumentar a cada 1 minuto até a exaustão voluntária.
                            </p>
                            <div>
                                <label className="block text-sm font-medium mb-1">Exercício Cardiovascular</label>
                                <button
                                    onClick={() => handleOpenPicker('incremental')}
                                    className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left"
                                >
                                    <span className={selectedExercise && pickerTarget === 'incremental' ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                        {(selectedExercise && pickerTarget === 'incremental') ? selectedExercise.name : 'Selecione um exercício cardio...'}
                                    </span>
                                    <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                </button>
                            </div>
                            {selectedExercise && pickerTarget === 'incremental' && (
                                <>
                                    <button
                                        onClick={() => startIncrementalTest(selectedExercise.id)}
                                        className="w-full bg-secondary hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center transition-colors shadow-lg"
                                    >
                                        Iniciar Teste Incremental
                                    </button>

                                    {cardioTestsHistory.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-bold text-light-text dark:text-dark-text mb-3 uppercase tracking-wider flex items-center">
                                                <CalendarIcon className="h-4 w-4 mr-2" /> Histórico do Teste
                                            </h4>
                                            <div className="space-y-2">
                                                {cardioTestsHistory.map(test => {
                                                    const sets = test.loggedExercises[0].sets;
                                                    const completedSets = sets.filter(s => s.completed);
                                                    const lastSet = completedSets[completedSets.length - 1] || sets[0];
                                                    return (
                                                        <div key={test.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex justify-between items-center border border-light-border dark:border-dark-border">
                                                            <div>
                                                                <p className="text-sm font-bold">{new Date(`${test.date}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                                                                <p className="text-xs text-light-text-secondary">{selectedExercise.name}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-secondary">{lastSet.value ?? '-'} <span className="text-xs font-normal">{selectedExercise.unit}</span></p>
                                                                <p className="text-[10px] text-light-text-secondary">Último Estágio: {completedSets.length}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </AccordionSection>
                </div>
            </main>
            {isExercisePickerOpen && (
                <ExercisePickerModal 
                    onClose={() => setIsExercisePickerOpen(false)}
                    onSelect={(ex) => {
                        setSelectedExercise(ex);
                        setIsExercisePickerOpen(false);
                    }}
                    allExercises={exercises}
                    categoryFilter={(pickerTarget === 'estimation' || pickerTarget === 'real1rm') ? ExerciseCategory.RESISTED : ExerciseCategory.CARDIO}
                />
            )}
        </div>
    );
};

export default PhysicalTestsScreen;