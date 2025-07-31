
import React, { useMemo } from 'react';

export interface ChartData {
    label: string;
    value: number;
    details?: { name: string; value: number; color: string }[];
}

export const BarChart: React.FC<{ data: ChartData[]; isStacked?: boolean; unit: string }> = ({ data, isStacked = false, unit }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10 p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                <p>Nenhum dado disponível para o período ou seleção.</p>
            </div>
        );
    }
    
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="relative h-64 mt-6" aria-label={`Gráfico de colunas de ${unit}`}>
            <div className="absolute top-0 bottom-0 -left-2 flex flex-col justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary -translate-x-full pr-2" aria-hidden="true">
                <span>{Math.ceil(maxValue)} {unit}</span>
                <span>0 {unit}</span>
            </div>
            <div className="h-full flex justify-around items-end gap-2 border-l border-b border-light-border dark:border-dark-border pl-2 pb-1">
                {data.map((item, index) => (
                    <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                        <div
                            className="w-full flex flex-col rounded-t-md overflow-hidden"
                            aria-label={`${item.label}: ${item.value} ${unit}`}
                            style={{ height: `${(item.value / maxValue) * 100}%` }}
                        >
                            {isStacked && item.details && item.details.length > 1 ? (
                                item.details.map((detail, detailIndex) => (
                                    <div
                                        key={detailIndex}
                                        className={`w-full transition-all group-hover:opacity-80 ${detailIndex < (item.details?.length || 0) - 1 ? 'border-b-2 border-black' : ''}`}
                                        style={{
                                            height: `${(detail.value / item.value) * 100}%`,
                                            backgroundColor: detail.color,
                                        }}
                                    />
                                ))
                            ) : (
                                <div
                                    className="w-full h-full"
                                    style={{ backgroundColor: item.details?.[0]?.color || '#3B82F6' }}
                                />
                            )}
                        </div>
                        <div className="absolute bottom-full mb-2 w-max max-w-xs p-2 bg-dark-bg text-dark-text text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none left-1/2 -translate-x-1/2 z-10">
                            <p className="font-bold border-b border-dark-border pb-1 mb-1 text-left">{item.label}: {item.value} {unit}</p>
                            {item.details && (
                                <ul className="list-none text-left space-y-1">
                                    {item.details.map((detail, i) => (
                                        <li key={i} className="whitespace-nowrap flex items-center">
                                            <span className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: detail.color }}></span>
                                            <span>{detail.name}: {detail.value} {unit}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ))}
            </div>
             <div className="flex justify-around items-start pt-1">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 text-center text-xs text-light-text-secondary dark:text-dark-text-secondary break-words px-1" title={item.label} aria-hidden="true">
                        {item.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const HorizontalBarChart: React.FC<{ data: ChartData[]; unit: string }> = ({ data, unit }) => {
    if (!data || data.filter(item => item.value > 0).length === 0) {
        return (
            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10 p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
                <p>Nenhum dado disponível.</p>
            </div>
        );
    }
    
    const sortedData = useMemo(() => [...data].filter(item => item.value > 0).sort((a, b) => b.value - a.value), [data]);
    const maxValue = useMemo(() => Math.max(...sortedData.map(d => d.value), 1), [sortedData]);

    return (
        <div className="mt-4 space-y-3 text-sm" aria-label={`Gráfico de barras de ${unit}`}>
            {sortedData.map((item, index) => (
                <div key={index} className="flex items-center gap-x-2">
                    <div className="w-2/5 text-right text-light-text dark:text-dark-text pr-2 font-medium break-words" title={item.label}>
                        {item.label}
                    </div>
                    <div className="w-3/5 flex items-center gap-3">
                        <div className="flex-grow bg-light-bg dark:bg-dark-bg rounded-full h-5 relative">
                           <div 
                                className="absolute top-0 left-0 h-5 bg-primary rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${(item.value / maxValue) * 100}%` }}
                            />
                        </div>
                        <span className="w-10 flex-shrink-0 text-left font-semibold text-light-text-secondary dark:text-dark-text-secondary">{item.value}</span>
                    </div>
                </div>
            ))}
            <div className="flex gap-2 mt-2 border-t border-light-border dark:border-dark-border pt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <div className="w-2/5" />
                <div className="w-3/5 flex items-center">
                    <div className="w-full flex justify-between">
                         <span>0</span>
                         <span>{Math.ceil(maxValue)} {unit}</span>
                    </div>
                    <div className="w-10 ml-3" />
                </div>
            </div>
        </div>
    );
};
