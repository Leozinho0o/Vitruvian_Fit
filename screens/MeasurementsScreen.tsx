import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { UserMeasurements, Gender, Evaluation } from '../types';
import { XIcon, ChevronDownIcon, TrashIcon } from '../components/Icons';
import CustomSelect, { CustomSelectOption } from '../components/CustomSelect';
import ConfirmationModal from '../components/ConfirmationModal';

// Accordion Section Component
interface AccordionSectionProps {
    title: string;
    children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-light-card dark:bg-dark-card rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
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

const MeasurementsScreen: React.FC = () => {
    const { 
        evaluations, 
        selectedEvaluationDate, 
        saveEvaluation, 
        deleteEvaluation,
        setIsMeasurementsScreenOpen 
    } = useApp();
    
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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


    const handleFieldChange = (field: keyof UserMeasurements, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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

            <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
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

                <AccordionSection title="Dados Pessoais">
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

                <AccordionSection title="Dobras Cutâneas">
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

                <AccordionSection title="Perímetros">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NumberInput id="abdominalPerimeter" label="Abdominal (umbigo)" unit="cm" value={formData.abdominalPerimeter} onChange={v => handleFieldChange('abdominalPerimeter', v)} />
                        <NumberInput id="forearmPerimeter" label="Antebraço Relaxado" unit="cm" value={formData.forearmPerimeter} onChange={v => handleFieldChange('forearmPerimeter', v)} />
                        <NumberInput id="biStyloidPerimeter" label="Biestiloide Rádio-Ulnar" unit="cm" value={formData.biStyloidPerimeter} onChange={v => handleFieldChange('biStyloidPerimeter', v)} />
                        <NumberInput id="biCondylarPerimeter" label="Bicondiliano Femural" unit="cm" value={formData.biCondylarPerimeter} onChange={v => handleFieldChange('biCondylarPerimeter', v)} />
                        <NumberInput id="waistPerimeter" label="Cintura" unit="m" value={formData.waistPerimeter} onChange={v => handleFieldChange('waistPerimeter', v)} />
                    </div>
                </AccordionSection>

                 <AccordionSection title="Composição Corporal">
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Seção em desenvolvimento.</p>
                </AccordionSection>

                <AccordionSection title="Estimativas">
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Seção em desenvolvimento.</p>
                </AccordionSection>

            </main>

            <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 flex justify-between items-center space-x-3 safe-bottom-padding bg-light-card dark:bg-dark-card">
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
                <div className="flex-grow flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsMeasurementsScreenOpen(false)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
                    <button type="button" onClick={handleSave} className="bg-secondary hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">Salvar</button>
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