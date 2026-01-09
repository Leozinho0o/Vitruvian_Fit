import React from 'react';
import { View } from '../types';
import { RepeatIcon, DumbbellIcon, CalendarIcon, BarChartIcon, SettingsIcon } from './Icons';

interface SidebarProps {
    activeView: View;
    setActiveView: (view: View) => void;
}

interface SidebarNavItemProps {
    icon: React.ReactNode;
    label: View;
    isActive: boolean;
    onClick: () => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${
            isActive 
                ? 'bg-primary text-white shadow' 
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card hover:text-light-text dark:hover:text-dark-text'
        }`}
    >
        <div className="h-6 w-6 mr-4">{icon}</div>
        <span className="font-semibold">{label}</span>
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
    const navItems = [
        { view: View.ROUTINES, icon: <RepeatIcon /> },
        { view: View.EXERCISES, icon: <DumbbellIcon /> },
        { view: View.CALENDAR, icon: <CalendarIcon /> },
        { view: View.STATS, icon: <BarChartIcon /> },
        { view: View.SETTINGS, icon: <SettingsIcon /> },
    ];

    return (
        <aside className="hidden lg:flex flex-col w-64 bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border p-4 flex-shrink-0">
            <div className="flex items-center mb-10 px-2">
                <DumbbellIcon className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold ml-3 text-light-text dark:text-dark-text">Vitruvian Fit</h1>
            </div>
            <nav className="flex flex-col space-y-2">
                {navItems.map(item => (
                    <SidebarNavItem
                        key={item.view}
                        icon={item.icon}
                        label={item.view}
                        isActive={activeView === item.view}
                        onClick={() => setActiveView(item.view)}
                    />
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;