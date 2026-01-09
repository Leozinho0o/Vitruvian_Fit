
import React, { useState, Fragment, useEffect } from 'react';
import { ChevronDownIcon, XIcon, CheckCircleIcon } from './Icons';

interface MethodPickerOption {
  value: string;
  label: string;
}

interface MethodPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (value: string | undefined) => void;
    options: MethodPickerOption[];
    currentValue: string | undefined;
    title?: string;
}

const MethodPickerModal: React.FC<MethodPickerModalProps> = ({ isOpen, onClose, onSelect, options, currentValue, title = "Selecionar Método" }) => {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Pequeno delay para permitir a animação de entrada
            requestAnimationFrame(() => setAnimate(true));
        } else {
            document.body.style.overflow = '';
            setAnimate(false);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true">
            {/* Backdrop com blur */}
            <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            
            {/* Conteúdo do Modal (Bottom Sheet) */}
            <div 
                className={`relative bg-light-card dark:bg-dark-card rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] transition-transform duration-300 ease-out transform ${animate ? 'translate-y-0' : 'translate-y-full'}`}
            >
                {/* Alça visual */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer"></div>
                </div>

                <header className="flex items-center justify-between px-6 py-3 border-b border-light-border dark:border-dark-border flex-shrink-0">
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 -mr-2 rounded-full hover:bg-light-bg dark:hover:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary"
                        aria-label="Fechar"
                    >
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                <div className="overflow-y-auto p-4 space-y-2">
                    {options.map(option => {
                        const isSelected = currentValue === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => onSelect(option.value)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] ${
                                    isSelected 
                                    ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                                    : 'bg-light-bg dark:bg-dark-bg border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-light-text dark:text-dark-text'
                                }`}
                            >
                                <span className={`font-bold text-left text-base ${isSelected ? 'text-primary' : ''}`}>
                                    {option.label}
                                </span>
                                {isSelected && <CheckCircleIcon className="h-6 w-6 text-primary flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                <footer className="p-4 border-t border-light-border dark:border-dark-border flex-shrink-0 pb-8 safe-bottom-padding">
                    <button 
                        onClick={() => onSelect(undefined)} 
                        className="w-full bg-gray-200 dark:bg-gray-700 text-light-text dark:text-dark-text font-bold py-3 px-4 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Limpar Seleção
                    </button>
                </footer>
            </div>
        </div>
    );
};

interface MethodPickerProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: MethodPickerOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

const MethodPicker: React.FC<MethodPickerProps> = ({ value, onChange, options, placeholder = "Selecione", disabled = false, className = "", title }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (val: string | undefined) => {
        onChange(val);
        setIsModalOpen(false);
    };

    return (
        <Fragment>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setIsModalOpen(true);
                }}
                className={`flex items-center gap-1 cursor-pointer select-none group active:opacity-70 transition-opacity ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                disabled={disabled}
            >
                <span className="truncate max-w-[160px] underline decoration-dotted underline-offset-4 decoration-2 decoration-light-text-secondary/50">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
            </button>
            <MethodPickerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={handleSelect}
                options={options}
                currentValue={value}
                title={title}
            />
        </Fragment>
    );
};

export default MethodPicker;
