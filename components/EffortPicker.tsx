
import React, { useState, Fragment } from 'react';
import { ChevronDownIcon, XIcon } from './Icons';

interface EffortPickerOption {
  value: string;
  label: string;
}

interface EffortPickerProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: EffortPickerOption[];
  placeholder?: string;
  disabled?: boolean;
}

const EffortPicker: React.FC<EffortPickerProps> = ({ value, onChange, options, placeholder = "Esforço", disabled = false }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (selectedValue: string | undefined) => {
        onChange(selectedValue);
        setIsModalOpen(false);
    };
    
    const EffortPickerModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col justify-end z-50" role="dialog" aria-modal="true">
            <div className="bg-light-card dark:bg-dark-card rounded-t-2xl max-h-[80vh] flex flex-col">
                <header className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border flex-shrink-0">
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Selecionar Esforço</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg" aria-label="Fechar">
                        <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </header>
                <div className="overflow-y-auto p-4">
                    <div className="space-y-2">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${value === option.value ? 'bg-primary/10 border-primary text-primary' : 'bg-light-bg dark:bg-dark-bg border-transparent hover:border-primary/50'}`}
                                role="option"
                                aria-selected={value === option.value}
                            >
                                <p className="font-bold text-light-text dark:text-dark-text">{option.value}</p>
                                <p className={`text-sm ${value === option.value ? 'text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{option.label}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 space-y-2">
                    <button
                        onClick={() => handleSelect(undefined)}
                        className="w-full bg-gray-200 dark:bg-gray-700 text-light-text dark:text-dark-text font-bold py-3 px-4 rounded-md"
                    >
                        Limpar Seleção
                    </button>
                </footer>
            </div>
        </div>
    );

    return (
        <Fragment>
            <button
                type="button"
                onClick={() => !disabled && setIsModalOpen(true)}
                className={`w-full h-full flex items-center justify-between bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md p-1 text-sm text-left transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={isModalOpen}
                disabled={disabled}
            >
                <span className={`truncate ${!selectedOption ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'text-light-text dark:text-dark-text'}`}>
                    {selectedOption ? selectedOption.value : placeholder}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
            </button>
            {isModalOpen && <EffortPickerModal />}
        </Fragment>
    );
};

export default EffortPicker;
