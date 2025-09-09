
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { Exercise, Unit, ExerciseCategory } from '../types';
import { XIcon, ChevronDownIcon, SearchIcon, DumbbellIcon } from '../components/Icons';
import { BarChart, ChartData } from '../components/Charts';
import { parseEffortToNumber } from '../utils';

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


interface ExercisePickerModalProps {
    onClose: () => void;
    onSelect: (exercise: Exercise) => void;
    allExercises: Exercise[];
}

const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ onClose, onSelect, allExercises }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const resistanceExercises = useMemo(() => 
        allExercises.filter(ex => ex.category === ExerciseCategory.RESISTED && ex.unit === Unit.KG)
    , [allExercises]);

    const filteredExercises = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return resistanceExercises;
        return resistanceExercises.filter(ex => ex.name.toLowerCase().includes(query));
    }, [resistanceExercises, searchQuery]);

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
                                    <DumbbellIcon className="h-6 w-6 text-light-text-secondary" />
                                )}
                            </div>
                            <span className="flex-grow">{ex.name}</span>
                        </button>
                    )) : (
                        <div className="text-center py-10 text-light-text-secondary dark:text-dark-text-secondary">
                            Nenhum exercício resistido com unidade KG encontrado.
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
    } = useApp();

    const [is1rmMultiRepOpen, setIs1rmMultiRepOpen] = useState(true);
    const [is1rmTestOpen, setIs1rmTestOpen] = useState(true);

    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    
    // Date filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selected1RMForTable, setSelected1RMForTable] = useState<number | null>(null);

    const onClose = () => {
        setIsPhysicalTestsScreenOpen(false);
    };

    const oneRmStats = useMemo(() => {
        if (!selectedExercise) return { history: [], highest1RM: null, bestSet: null };

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
                        if (effortValue < 9) continue;

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

    }, [selectedExercise, workouts, routines, evaluations]);

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

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding border-b border-light-border dark:border-dark-border">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Testes Físicos</h2>
                <button type="button" onClick={onClose} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                    <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
            </header>
            <main className="flex-grow overflow-y-auto overflow-x-auto p-4 md:p-6 space-y-6">
                <div className="inline-block min-w-full space-y-6">
                    <AccordionSection title="Teste de 1RM baseado em repetições múltiplas" isOpen={is1rmMultiRepOpen} onToggle={() => setIs1rmMultiRepOpen(v => !v)}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Exercício</label>
                                <button
                                    onClick={() => setIsExercisePickerOpen(true)}
                                    className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left"
                                >
                                    <span className={selectedExercise ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                        {selectedExercise?.name || 'Selecione um exercício...'}
                                    </span>
                                    <SearchIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                </button>
                            </div>
                            {selectedExercise && (
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
                                        *Cálculo baseado em séries com esforço (PSE/RIR) igual ou superior a 9.
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
                    <AccordionSection title="Teste de 1RM" isOpen={is1rmTestOpen} onToggle={() => setIs1rmTestOpen(v => !v)}>
                        <div className="text-center text-light-text-secondary dark:text-dark-text-secondary p-4">
                            <p>Em desenvolvimento.</p>
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
                />
            )}
        </div>
    );
};

export default PhysicalTestsScreen;
