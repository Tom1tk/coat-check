import React from 'react';
import SpotlightCard from './SpotlightCard';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
    className?: string;
    onToggle: () => void;
}

export default function ThemeToggle({ className, onToggle }: ThemeToggleProps) {
    // Icons use Tailwind 'dark:' classes which depend on the HTML class attribute,
    // so we don't need the useTheme hook here - CSS handles the visual state.

    return (
        <SpotlightCard
            onClick={onToggle}
            className={`glass-panel cursor-pointer hover:bg-white/10 text-black dark:text-white p-3 rounded-full shadow-lg flex items-center justify-center transition-[background-color,box-shadow] duration-300 w-12 h-12 ${className || ''}`}
            title="Toggle Theme"
        >
            <div className="relative w-6 h-6">
                {/* Wrap SVG in animated div for hardware acceleration */}
                <div className="absolute inset-0 transition-[transform,opacity] duration-500 rotate-0 scale-100 opacity-100 dark:-rotate-90 dark:scale-0 dark:opacity-0">
                    <Sun className="w-full h-full" />
                </div>
                <div className="absolute inset-0 transition-[transform,opacity] duration-500 rotate-90 scale-0 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100">
                    <Moon className="w-full h-full" />
                </div>
            </div>
        </SpotlightCard>
    );
}

