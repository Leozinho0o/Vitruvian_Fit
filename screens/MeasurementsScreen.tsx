

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { UserMeasurements, Gender, Evaluation } from '../types';
import { XIcon, ChevronDownIcon, TrashIcon, FileTextIcon } from '../components/Icons';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';
import ConfirmationModal from '../components/ConfirmationModal';
import { 
    BodyFatAuthor, 
    calculateBodyFatPetroski,
    calculateBodyFatJacksonPollock,
    calculateBodyFatYMCA,
    calculateBodyFatGuedes,
    calculateBoneWeight,
    calculateResidualWeight,
    calculateMuscleWeight,
    BodyFatResult,
    FormulaResult
} from '../utils';

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
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{title}</h3>
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

// Number Input Component
interface NumberInputProps {
    id: string;
    label: string;
    unit: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
}

const NumberInput: React.FC<NumberInputProps> = ({ id, label, unit, value, onChange, placeholder, disabled = false }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val === '' ? undefined : parseFloat(val));
    };

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium mb-1">{label} <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">({unit})</span></label>
            <input
                type="number"
                id={id}
                inputMode="decimal"
                step="any"
                value={value ?? ''}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 disabled:opacity-50"
            />
        </div>
    );
};

// Stat Display Component
const StatDisplay: React.FC<{ title: string; value: string; unit: string }> = ({ title, value, unit }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg text-center">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
        <p className="text-4xl font-bold text-primary">{value} <span className="text-2xl font-medium">{unit}</span></p>
    </div>
);

// Sub-Stat Display Component for Fat/Lean Mass
const SubStatDisplay: React.FC<{ title: string; value: string; unit: string }> = ({ title, value, unit }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-2 rounded-lg text-center">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
        <p className="text-xl font-bold text-light-text dark:text-dark-text">{value} <span className="text-base font-medium">{unit}</span></p>
    </div>
);

const MeasurementsScreen: React.FC = () => {
    const { 
        evaluations, 
        selectedEvaluationDate, 
        saveEvaluation, 
        deleteEvaluation,
        setIsMeasurementsScreenOpen 
    } = useApp();
    
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [selectedAuthorForMuscle, setSelectedAuthorForMuscle] = useState<string>(BodyFatAuthor.PETROSKI);

    // State for accordions
    const [isDadosPessoaisOpen, setIsDadosPessoaisOpen] = useState(true);
    const [isDobrasCutaneasOpen, setIsDobrasCutaneasOpen] = useState(true);
    const [isPerimetrosOpen, setIsPerimetrosOpen] = useState(true);
    const [isComposicaoOpen, setIsComposicaoOpen] = useState(true);
    const [isEstimativasOpen, setIsEstimativasOpen] = useState(true);

    // The date for the current form. For new evaluations, it's today's date. For existing, it's the selected date.
    const [evaluationDate, setEvaluationDate] = useState(() => 
        selectedEvaluationDate || new Date().toISOString().split('T')[0]
    );

    const [formData, setFormData] = useState<Partial<UserMeasurements>>(() => {
        if (selectedEvaluationDate) {
            return evaluations.find((e: Evaluation) => e.date === selectedEvaluationDate)?.measurements || {};
        }
        return {};
    });

    const isEditing = !!selectedEvaluationDate;

    const genderOptions: CustomSelectOption[] = [
        { value: Gender.MALE, label: 'Masculino' },
        { value: Gender.FEMALE, label: 'Feminino' },
    ];
    
    // Auto-calculate stature in meters
    useEffect(() => {
        if (formData.statureCm) {
            const statureInMeters = parseFloat((formData.statureCm / 100).toFixed(2));
            if (formData.statureM !== statureInMeters) {
                handleFieldChange('statureM', statureInMeters);
            }
        } else if (formData.statureM !== undefined) {
            handleFieldChange('statureM', undefined);
        }
    }, [formData.statureCm]);


    const { 
        bodyFatPetroski, 
        bodyFatJacksonPollock, 
        bodyFatYMCA, 
        bodyFatGuedes, 
        boneWeight, 
        residualWeight, 
        muscleWeight,
        muscleWeightPercentage
    } = useMemo(() => {
        const petroski = calculateBodyFatPetroski(formData);
        const jackson = calculateBodyFatJacksonPollock(formData);
        const ymca = calculateBodyFatYMCA(formData);
        const guedes = calculateBodyFatGuedes(formData);
        const bone = calculateBoneWeight(formData);
        const residual = calculateResidualWeight(formData);

        let selectedFatCalc: BodyFatResult;
        switch (selectedAuthorForMuscle) {
            case BodyFatAuthor.JACKSON_POLLOCK: selectedFatCalc = jackson; break;
            case BodyFatAuthor.YMCA: selectedFatCalc = ymca; break;
            case BodyFatAuthor.GUEDES: selectedFatCalc = guedes; break;
            default: selectedFatCalc = petroski; break;
        }
        
        const fatMassAsFormulaResult: FormulaResult = { value: selectedFatCalc.fatMass, missing: selectedFatCalc.missing };
        const muscle = calculateMuscleWeight(formData, fatMassAsFormulaResult, bone, residual);
        
        let musclePercent: FormulaResult = { value: null, missing: muscle.missing };
        if (muscle.value && formData.bodyMass) {
            const percentage = (muscle.value * 100) / formData.bodyMass;
            musclePercent = { value: percentage, missing: null };
        }

        return {
            bodyFatPetroski: petroski,
            bodyFatJacksonPollock: jackson,
            bodyFatYMCA: ymca,
            bodyFatGuedes: guedes,
            boneWeight: bone,
            residualWeight: residual,
            muscleWeight: muscle,
            muscleWeightPercentage: musclePercent
        };
    }, [formData, selectedAuthorForMuscle]);


    const handleFieldChange = (field: keyof UserMeasurements, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
    
        const wereExpanded = {
            dadosPessoais: isDadosPessoaisOpen,
            dobrasCutaneas: isDobrasCutaneasOpen,
            perimetros: isPerimetrosOpen,
            composicao: isComposicaoOpen,
            estimativas: isEstimativasOpen,
        };
    
        // Expand all sections
        setIsDadosPessoaisOpen(true);
        setIsDobrasCutaneasOpen(true);
        setIsPerimetrosOpen(true);
        setIsComposicaoOpen(true);
        setIsEstimativasOpen(true);
    
        // Wait for UI to re-render
        await new Promise(resolve => setTimeout(resolve, 500));
    
        const { jsPDF } = (window as any).jspdf;
        const html2canvas = (window as any).html2canvas;
    
        if (!jsPDF || !html2canvas) {
            alert("Erro ao carregar bibliotecas de PDF. Por favor, recarregue a página.");
            setIsGeneratingPdf(false);
            return;
        }
    
        const captureArea = document.getElementById('measurements-capture-area');
        const header = document.querySelector('header');
        const footer = document.querySelector('footer');
    
        if (!captureArea) {
            console.error("Capture area not found!");
            setIsGeneratingPdf(false);
            return;
        }
    
        // Hide header and footer
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';
        
        try {
            const canvas = await html2canvas(captureArea, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: window.getComputedStyle(document.body).backgroundColor,
                // Capture full scroll height
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
            
            const dateFormatted = new Date(`${evaluationDate}T00:00:00`).toLocaleDateString('pt-BR');
            pdf.save(`Avaliacao_Fisica_${dateFormatted.replace(/\//g, '-')}.pdf`);
    
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
        } finally {
            setIsGeneratingPdf(false);
            // Restore elements
            if (header) header.style.display = 'flex';
            if (footer) footer.style.display = 'flex';
            
            // Restore original expanded state
            setIsDadosPessoaisOpen(wereExpanded.dadosPessoais);
            setIsDobrasCutaneasOpen(wereExpanded.dobrasCutaneas);
            setIsPerimetrosOpen(wereExpanded.perimetros);
            setIsComposicaoOpen(wereExpanded.composicao);
            setIsEstimativasOpen(wereExpanded.estimativas);
        }
    };

    const handleSave = () => {
        if (!evaluationDate) {
            alert("A data da avaliação é obrigatória.");
            return;
        }

        // Prevent creating a new evaluation on a date that already has one
        if (!isEditing && evaluations.some((e: Evaluation) => e.date === evaluationDate)) {
            alert("Já existe uma avaliação salva para esta data. Selecione-a na tela de Configurações para editar.");
            return;
        }
        
        const evaluation: Evaluation = {
            date: evaluationDate,
            measurements: formData
        };
        saveEvaluation(evaluation);
        setIsMeasurementsScreenOpen(false);
    };

    const handleDelete = () => {
        if (selectedEvaluationDate) {
            deleteEvaluation(selectedEvaluationDate);
            setIsMeasurementsScreenOpen(false);
        }
        setIsDeleteConfirmOpen(false);
    };

    return (
        <div className="h-full w-full bg-light-bg dark:bg-dark-bg flex flex-col font-sans">
            <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-16 flex items-center justify-between px-4 safe-top-padding border-b border-light-border dark:border-dark-border">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                     {isEditing ? 'Editar Avaliação' : 'Nova Avaliação'}
                </h2>
                <button type="button" onClick={() => setIsMeasurementsScreenOpen(false)} className="p-1 rounded-full flex items-center justify-center hover:bg-light-bg dark:hover:bg-dark-bg">
                    <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
            </header>

            <main id="measurements-capture-area" className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
                <div className="bg-light-card dark:bg-dark-card rounded-lg p-4">
                    <label htmlFor="evaluationDate" className="block text-sm font-medium mb-1">Data da Avaliação</label>
                    <input
                        type="date"
                        id="evaluationDate"
                        value={evaluationDate}
                        onChange={(e) => setEvaluationDate(e.target.value)}
                        disabled={isEditing}
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 disabled:opacity-70"
                        max={new Date().toISOString().split('T')[0]} // Cannot set future dates
                    />
                </div>

                <AccordionSection title="Dados Pessoais" isOpen={isDadosPessoaisOpen} onToggle={() => setIsDadosPessoaisOpen(v => !v)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NumberInput id="bodyMass" label="Massa Corporal" unit="kg" value={formData.bodyMass} onChange={v => handleFieldChange('bodyMass', v)} />
                        <NumberInput id="age" label="Idade" unit="anos" value={formData.age} onChange={v => handleFieldChange('age', v)} />
                         <div>
                            <label htmlFor="gender" className="block text-sm font-medium mb-1">Gênero</label>
                            <CustomSelect
                                id="gender"
                                options={genderOptions}
                                value={formData.gender}
                                onChange={v => handleFieldChange('gender', v as Gender | undefined)}
                                placeholder="Selecione..."
                            />
                        </div>
                        <NumberInput id="statureCm" label="Estatura" unit="cm" value={formData.statureCm} onChange={v => handleFieldChange('statureCm', v)} />
                        <NumberInput id="statureM" label="Estatura" unit="m" value={formData.statureM} onChange={() => {}} disabled={true} />
                    </div>
                </AccordionSection>

                <AccordionSection title="Dobras Cutâneas" isOpen={isDobrasCutaneasOpen} onToggle={() => setIsDobrasCutaneasOpen(v => !v)}>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <NumberInput id="subscapularFold" label="Subescapular" unit="mm" value={formData.subscapularFold} onChange={v => handleFieldChange('subscapularFold', v)} />
                        <NumberInput id="tricepsFold" label="Tricipital" unit="mm" value={formData.tricepsFold} onChange={v => handleFieldChange('tricepsFold', v)} />
                        <NumberInput id="bicepsFold" label="Bicipital" unit="mm" value={formData.bicepsFold} onChange={v => handleFieldChange('bicepsFold', v)} />
                        <NumberInput id="pectoralFold" label="Peitoral" unit="mm" value={formData.pectoralFold} onChange={v => handleFieldChange('pectoralFold', v)} />
                        <NumberInput id="midaxillaryFold" label="Axilar Média" unit="mm" value={formData.midaxillaryFold} onChange={v => handleFieldChange('midaxillaryFold', v)} />
                        <NumberInput id="suprailiacFold" label="Suprailíaca" unit="mm" value={formData.suprailiacFold} onChange={v => handleFieldChange('suprailiacFold', v)} />
                        <NumberInput id="abdominalFold" label="Abdominal" unit="mm" value={formData.abdominalFold} onChange={v => handleFieldChange('abdominalFold', v)} />
                        <NumberInput id="thighFold" label="Coxa Média" unit="mm" value={formData.thighFold} onChange={v => handleFieldChange('thighFold', v)} />
                        <NumberInput id="medialCalfFold" label="Panturrilha Medial" unit="mm" value={formData.medialCalfFold} onChange={v => handleFieldChange('medialCalfFold', v)} />
                    </div>
                </AccordionSection>

                <AccordionSection title="Perímetros" isOpen={isPerimetrosOpen} onToggle={() => setIsPerimetrosOpen(v => !v)}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NumberInput id="abdominalPerimeter" label="Abdominal (umbigo)" unit="cm" value={formData.abdominalPerimeter} onChange={v => handleFieldChange('abdominalPerimeter', v)} />
                        <NumberInput id="forearmPerimeter" label="Antebraço Relaxado" unit="cm" value={formData.forearmPerimeter} onChange={v => handleFieldChange('forearmPerimeter', v)} />
                        <NumberInput id="biStyloidPerimeter" label="Biestiloide Rádio-Ulnar" unit="cm" value={formData.biStyloidPerimeter} onChange={v => handleFieldChange('biStyloidPerimeter', v)} />
                        <NumberInput id="biCondylarPerimeter" label="Bicondiliano Femural" unit="cm" value={formData.biCondylarPerimeter} onChange={v => handleFieldChange('biCondylarPerimeter', v)} />
                        <NumberInput id="waistPerimeter" label="Cintura" unit="m" value={formData.waistPerimeter} onChange={v => handleFieldChange('waistPerimeter', v)} />
                    </div>
                </AccordionSection>

                 <AccordionSection title="Composição Corporal" isOpen={isComposicaoOpen} onToggle={() => setIsComposicaoOpen(v => !v)}>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Petroski</h4>
                            {bodyFatPetroski.value !== null ? (
                                <div className="space-y-2">
                                    <StatDisplay 
                                        title="Percentual de Gordura"
                                        value={bodyFatPetroski.value.toFixed(2)}
                                        unit="%"
                                    />
                                    {bodyFatPetroski.fatMass && bodyFatPetroski.leanMass ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SubStatDisplay title="Peso Gordura" value={bodyFatPetroski.fatMass.toFixed(2)} unit="kg" />
                                            <SubStatDisplay title="Peso Magro" value={bodyFatPetroski.leanMass.toFixed(2)} unit="kg" />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary p-2 bg-light-bg dark:bg-dark-bg rounded-lg">
                                            Informe a Massa Corporal para ver o peso de gordura e o peso magro.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{bodyFatPetroski.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-light-border dark:border-dark-border">
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Jackson &amp; Pollock (7 Dobras)</h4>
                            {bodyFatJacksonPollock.value !== null ? (
                                <div className="space-y-2">
                                    <StatDisplay 
                                        title="Percentual de Gordura"
                                        value={bodyFatJacksonPollock.value.toFixed(2)}
                                        unit="%"
                                    />
                                    {bodyFatJacksonPollock.fatMass && bodyFatJacksonPollock.leanMass ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SubStatDisplay title="Peso Gordura" value={bodyFatJacksonPollock.fatMass.toFixed(2)} unit="kg" />
                                            <SubStatDisplay title="Peso Magro" value={bodyFatJacksonPollock.leanMass.toFixed(2)} unit="kg" />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary p-2 bg-light-bg dark:bg-dark-bg rounded-lg">
                                            Informe a Massa Corporal para ver o peso de gordura e o peso magro.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{bodyFatJacksonPollock.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-light-border dark:border-dark-border">
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">YMCA (3 Dobras)</h4>
                            {bodyFatYMCA.value !== null ? (
                                <div className="space-y-2">
                                    <StatDisplay 
                                        title="Percentual de Gordura"
                                        value={bodyFatYMCA.value.toFixed(2)}
                                        unit="%"
                                    />
                                    {bodyFatYMCA.fatMass && bodyFatYMCA.leanMass ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SubStatDisplay title="Peso Gordura" value={bodyFatYMCA.fatMass.toFixed(2)} unit="kg" />
                                            <SubStatDisplay title="Peso Magro" value={bodyFatYMCA.leanMass.toFixed(2)} unit="kg" />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary p-2 bg-light-bg dark:bg-dark-bg rounded-lg">
                                            Informe a Massa Corporal para ver o peso de gordura e o peso magro.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{bodyFatYMCA.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-light-border dark:border-dark-border">
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Guedes</h4>
                            {bodyFatGuedes.value !== null ? (
                                <div className="space-y-2">
                                    <StatDisplay 
                                        title="Percentual de Gordura"
                                        value={bodyFatGuedes.value.toFixed(2)}
                                        unit="%"
                                    />
                                    {bodyFatGuedes.fatMass && bodyFatGuedes.leanMass ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SubStatDisplay title="Peso Gordura" value={bodyFatGuedes.fatMass.toFixed(2)} unit="kg" />
                                            <SubStatDisplay title="Peso Magro" value={bodyFatGuedes.leanMass.toFixed(2)} unit="kg" />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary p-2 bg-light-bg dark:bg-dark-bg rounded-lg">
                                            Informe a Massa Corporal para ver o peso de gordura e o peso magro.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{bodyFatGuedes.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary pt-2">Mais autores em desenvolvimento.</p>
                    </div>
                </AccordionSection>

                <AccordionSection title="Estimativas" isOpen={isEstimativasOpen} onToggle={() => setIsEstimativasOpen(v => !v)}>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Peso Ósseo</h4>
                            {boneWeight.value !== null ? (
                                <StatDisplay
                                    title="Peso Ósseo Estimado"
                                    value={boneWeight.value.toFixed(2)}
                                    unit="kg"
                                />
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{boneWeight.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-light-border dark:border-dark-border">
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Peso Residual</h4>
                            {residualWeight.value !== null ? (
                                <StatDisplay
                                    title="Peso Residual Estimado"
                                    value={residualWeight.value.toFixed(2)}
                                    unit="kg"
                                />
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{residualWeight.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-light-border dark:border-dark-border">
                            <h4 className="text-md font-semibold text-light-text dark:text-dark-text mb-2">Peso Muscular</h4>
                             <div className="mb-4">
                                <label htmlFor="fatAuthorSelect" className="block text-sm font-medium mb-1">Usar % de Gordura de:</label>
                                <CustomSelect
                                    id="fatAuthorSelect"
                                    options={Object.values(BodyFatAuthor).map(author => ({ value: author, label: author }))}
                                    value={selectedAuthorForMuscle}
                                    onChange={(val) => setSelectedAuthorForMuscle(val as string)}
                                    allowDeselect={false}
                                />
                            </div>
                            {muscleWeight.value !== null ? (
                                <div className="space-y-2">
                                    <StatDisplay
                                        title="Peso Muscular Estimado"
                                        value={muscleWeight.value.toFixed(2)}
                                        unit="kg"
                                    />
                                    {muscleWeightPercentage.value !== null ? (
                                        <SubStatDisplay
                                            title="% de Peso Muscular"
                                            value={muscleWeightPercentage.value.toFixed(2)}
                                            unit="%"
                                        />
                                    ) : (
                                        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary p-2 bg-light-bg dark:bg-dark-bg rounded-lg">
                                            {muscleWeightPercentage.missing || "Não foi possível calcular a porcentagem."}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                                    <p className="font-semibold mb-1">Dados necessários:</p>
                                    <p>{muscleWeight.missing || "Preencha os dados necessários para o cálculo."}</p>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary pt-2">Mais estimativas em desenvolvimento.</p>
                    </div>
                </AccordionSection>

            </main>

            <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 flex justify-between items-center space-x-3 safe-bottom-padding bg-light-card dark:bg-dark-card">
                 <div className="flex items-center space-x-3">
                    {isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded-md flex items-center justify-center"
                            aria-label="Apagar avaliação"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf || !isEditing}
                        className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50"
                        aria-label="Gerar PDF da avaliação"
                    >
                        <FileTextIcon className="h-5 w-5 sm:mr-2" />
                        <span className="hidden sm:inline">{isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}</span>
                    </button>
                </div>
                <div className="flex-grow flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsMeasurementsScreenOpen(false)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                    <button type="button" onClick={handleSave} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-md">Salvar</button>
                </div>
            </footer>
            {isDeleteConfirmOpen && (
                 <ConfirmationModal
                    isOpen={isDeleteConfirmOpen}
                    onClose={() => setIsDeleteConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Confirmar Exclusão"
                    message="Tem certeza que deseja apagar esta avaliação? Esta ação não pode ser desfeita."
                />
            )}
        </div>
    );
};

export default MeasurementsScreen;