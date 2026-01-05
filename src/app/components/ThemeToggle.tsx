import React from 'react';
import SpotlightCard from './SpotlightCard';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
    className?: string;
    onToggle: () => void;
}

export default function ThemeToggle({ className, onToggle }: ThemeToggleProps) {
    // We only need the hook for context, not the value if we don't use it.
    // Actually we don't even need the hook here if we don't read from it, 
    // but maybe we want to guard against missing provider?
    // Since onToggle handles the logic in parent, we just render the button.
    // But wait, the icon depends on the theme? 
    // "Let's show a generic toggle icon or the current state."
    // In my code:
    // <Sun className={`... rotate-0 scale-100 dark:-rotate-90 dark:scale-0`} />
    // The icon uses Tailwind 'dark:' classes which depend on the HTML class attribute, NOT the hook state directly.
    // So 'theme' variable IS unused.
    useTheme();

    // Determine icon based on current theme state
    // Note: We might be in "auto" mode conceptually, but next-themes resolves it to 'system', 'light', or 'dark'
    // For the icon, we just show what it IS or what it WILL BE? 
    // Let's show a generic toggle icon or the current state.
    // User asked for a simple button. Let's use Sun/Moon.

    return (
        <SpotlightCard
            onClick={onToggle}
            className={`glass-panel cursor-pointer hover:bg-white/10 text-black dark:text-white p-3 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 w-12 h-12 ${className || ''}`}
            title="Toggle Theme"
        >
            <div className="relative w-6 h-6">
                <Sun className={`absolute inset-0 w-full h-full transition-all duration-500 rotate-0 scale-100 dark:-rotate-90 dark:scale-0`} />
                <Moon className={`absolute inset-0 w-full h-full transition-all duration-500 rotate-90 scale-0 dark:rotate-0 dark:scale-100`} />
            </div>
        </SpotlightCard>
    );
}
