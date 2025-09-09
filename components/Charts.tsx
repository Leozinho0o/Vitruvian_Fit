
import React, { useMemo, useState } from 'react';

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
    
    const chartContainerStyle = {
        minWidth: `calc(${data.length} * 3rem)`, // Each bar gets at least 3rem (48px)
    };

    return (
        <div className="relative h-64 mt-6" aria-label={`Gráfico de colunas de ${unit}`}>
            <div className="absolute top-0 bottom-0 -left-2 flex flex-col justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary -translate-x-full pr-2" aria-hidden="true">
                <span>{Math.ceil(maxValue)} {unit}</span>
                <span>0 {unit}</span>
            </div>
            
            <div style={chartContainerStyle} className="h-full w-full flex flex-col">
                <div className="flex-grow flex justify-around items-end gap-2 border-l border-b border-light-border dark:border-dark-border pl-2 pb-1">
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
                                            <li key={i} className="flex items-start">
                                                <span className="h-2 w-2 rounded-full mr-2 mt-1 flex-shrink-0" style={{ backgroundColor: detail.color }}></span>
                                                <span className="break-words">{detail.name}: {detail.value} {unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="flex-shrink-0 flex justify-around items-start pt-1">
                    {data.map((item, index) => (
                        <div key={index} className="flex-1 text-center text-xs text-light-text-secondary dark:text-dark-text-secondary break-words px-1" title={item.label} aria-hidden="true">
                            {item.label}
                        </div>
                    ))}
                </div>
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


export interface LineChartDataset {
    label: string;
    data: (number | null)[];
    color: string;
}

export interface LineChartProps {
    datasets: LineChartDataset[];
    labels: string[];
    unit: string;
}

export const LineChart: React.FC<LineChartProps> = ({ datasets, labels, unit }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; data: { label: string; value: number; color: string }[] } | null>(null);

    const chartRef = React.useRef<SVGSVGElement>(null);

    const chartDimensions = {
        width: 500,
        height: 300,
        padding: { top: 20, right: 20, bottom: 50, left: 50 },
    };

    const { chartWidth, chartHeight } = useMemo(() => ({
        chartWidth: chartDimensions.width - chartDimensions.padding.left - chartDimensions.padding.right,
        chartHeight: chartDimensions.height - chartDimensions.padding.top - chartDimensions.padding.bottom,
    }), [chartDimensions]);

    const { yMin, yMax, xPoints } = useMemo(() => {
        const allData = datasets.flatMap(ds => ds.data.filter(d => d !== null) as number[]);
        const yMin = Math.min(0, ...allData);
        const yMax = Math.max(1, ...allData); // Ensure max is at least 1 to avoid division by zero
        const xPoints = labels.map((_, i) => chartDimensions.padding.left + (i / (labels.length - 1 || 1)) * chartWidth);
        return { yMin, yMax, xPoints };
    }, [datasets, labels, chartWidth, chartDimensions.padding.left]);

    const yPoints = (data: (number | null)[]) => data.map(d => d === null ? null : chartDimensions.padding.top + chartHeight - ((d - yMin) / (yMax - yMin)) * chartHeight);

    const createPath = (points: (number | null)[]) => {
        let path = '';
        let firstPoint = true;
        points.forEach((p, i) => {
            if (p !== null) {
                if (firstPoint) {
                    path += `M ${xPoints[i]} ${p}`;
                    firstPoint = false;
                } else {
                    path += ` L ${xPoints[i]} ${p}`;
                }
            } else {
                firstPoint = true;
            }
        });
        return path;
    };
    
    const handleMouseOver = (e: React.MouseEvent<SVGCircleElement>, label: string, index: number) => {
        const dataForTooltip = datasets.map(ds => ({
            label: ds.label,
            value: ds.data[index]!,
            color: ds.color
        })).filter(d => d.value !== null);
        
        const chartRect = chartRef.current?.getBoundingClientRect();
        if(!chartRect) return;

        setTooltip({
            x: e.clientX - chartRect.left,
            y: e.clientY - chartRect.top,
            label,
            data: dataForTooltip,
        });
    };

    if (!datasets || datasets.length === 0 || datasets.every(ds => ds.data.every(d => d === null))) {
         return (
            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary mt-10 p-4 bg-light-bg dark:bg-dark-bg rounded-lg h-64 flex items-center justify-center">
                <p>Selecione as datas e métricas para exibir o gráfico.</p>
            </div>
        );
    }
    
    return (
        <div className="relative w-full">
            <svg ref={chartRef} viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`} className="w-full h-auto text-light-text-secondary dark:text-dark-text-secondary" aria-label={`Gráfico de linha de ${unit}`}>
                {/* Y-Axis Grid Lines and Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                    <g key={tick} className="tick">
                        <line
                            x1={chartDimensions.padding.left}
                            x2={chartDimensions.width - chartDimensions.padding.right}
                            y1={chartDimensions.padding.top + chartHeight * (1 - tick)}
                            y2={chartDimensions.padding.top + chartHeight * (1 - tick)}
                            className="stroke-current opacity-20"
                            strokeWidth="1"
                        />
                        <text
                            x={chartDimensions.padding.left - 8}
                            y={chartDimensions.padding.top + chartHeight * (1 - tick)}
                            textAnchor="end"
                            alignmentBaseline="middle"
                            className="text-xs fill-current"
                        >
                            {Math.round(yMin + (yMax - yMin) * tick)}
                        </text>
                    </g>
                ))}

                {/* X-Axis Labels */}
                {labels.map((label, i) => (
                    <text
                        key={i}
                        x={xPoints[i]}
                        y={chartDimensions.height - chartDimensions.padding.bottom + 15}
                        textAnchor="middle"
                        className="text-xs fill-current"
                    >
                        {label}
                    </text>
                ))}

                {/* Lines and Points */}
                {datasets.map((ds, dsIndex) => {
                    const yData = yPoints(ds.data);
                    return (
                        <g key={dsIndex}>
                            <path d={createPath(yData)} stroke={ds.color} strokeWidth="2" fill="none" />
                            {ds.data.map((d, i) => d !== null && (
                                <circle
                                    key={i}
                                    cx={xPoints[i]}
                                    cy={yData[i]!}
                                    r="4"
                                    fill={ds.color}
                                    className="cursor-pointer"
                                    onMouseOver={(e) => handleMouseOver(e, labels[i], i)}
                                    onMouseOut={() => setTooltip(null)}
                                />
                            ))}
                        </g>
                    );
                })}
            </svg>
            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute p-2 bg-dark-bg text-dark-text text-xs rounded-md shadow-lg pointer-events-none z-10"
                    style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
                >
                    <p className="font-bold border-b border-dark-border pb-1 mb-1">{tooltip.label}</p>
                    <ul className="list-none space-y-1">
                        {tooltip.data.map((item, i) => (
                            <li key={i} className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                {item.label}: {item.value} {unit}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
             {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-sm">
                {datasets.map((ds) => (
                    <div key={ds.label} className="flex items-center">
                        <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: ds.color }}></span>
                        <span className="text-light-text dark:text-dark-text">{ds.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
