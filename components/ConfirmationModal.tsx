import React from 'react';
import { XIcon, TrashIcon, InfoIcon } from './Icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
  showCancelButton?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Sim, Excluir',
  cancelText = 'Não, Cancelar',
  variant = 'danger',
  showCancelButton = true,
}) => {
  if (!isOpen) return null;

  const titleIcon = variant === 'danger' ? <TrashIcon className="h-6 w-6 mr-2" /> : <InfoIcon className="h-6 w-6 mr-2" />;
  const titleColor = variant === 'danger' ? 'text-red-600 dark:text-red-500' : 'text-primary dark:text-blue-400';
  const confirmButtonClass = variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-light-card dark:bg-dark-card rounded-lg p-6 w-full max-w-sm text-light-text dark:text-dark-text shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-xl font-bold flex items-center ${titleColor}`}>
            {titleIcon}
            {title}
          </h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700">
            <XIcon className="h-6 w-6 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </div>
        <div className="mb-6 text-light-text dark:text-dark-text">
            {message}
        </div>
        <div className="flex justify-end space-x-3">
          {showCancelButton && (
            <button
              onClick={onClose}
              className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`${confirmButtonClass} text-white font-bold py-2 px-4 rounded-md`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
