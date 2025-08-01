import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './Icons';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  id?: string;
  allowDeselect?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, placeholder = 'Selecione...', id, allowDeselect = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelect = (optionValue: string | undefined) => {
        if (optionValue === undefined && !allowDeselect) {
            setIsOpen(false);
            return;
        }
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <button
                type="button"
                id={id}
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-10 flex items-center justify-between bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md p-2 text-left text-light-text dark:text-dark-text"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {selectedOption ? (
                    <span className="flex items-center">
                        {selectedOption.icon && <span className="mr-2 flex-shrink-0">{selectedOption.icon}</span>}
                        <span className="truncate">{selectedOption.label}</span>
                    </span>
                ) : (
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{placeholder}</span>
                )}
                <ChevronDownIcon className={`h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute top-full mt-1 w-full max-h-60 overflow-y-auto bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-xl z-30 p-1"
                    role="listbox"
                >
                    {placeholder && allowDeselect && (
                         <button
                             type="button"
                             onClick={() => handleSelect(undefined)}
                             className={`w-full text-left flex items-center p-2 text-sm rounded-md hover:bg-light-bg dark:hover:bg-dark-bg ${!value ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-light-text dark:text-dark-text'}`}
                             role="option"
                             aria-selected={!value}
                         >
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">{placeholder}</span>
                         </button>
                    )}
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={`w-full text-left flex items-center p-2 text-sm rounded-md hover:bg-light-bg dark:hover:bg-dark-bg ${value === option.value ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-light-text dark:text-dark-text'}`}
                            role="option"
                            aria-selected={value === option.value}
                        >
                            {option.icon && <span className="mr-2 flex-shrink-0">{option.icon}</span>}
                            <span className="truncate">{option.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
