import React from 'react';
import { Location } from '../hooks/useLocation';
import LocationSearch from './LocationSearch';
import SpotlightText from './SpotlightText';

interface HeaderProps {
    displayDay: 'today' | 'tomorrow';
    handleDayToggle: () => void;
    location: Location;
    setLocation: (loc: Location) => void;
    fade: boolean;
    pageVisible: boolean;
    FADE_DURATION: number;
}

export default function Header({
    displayDay,
    handleDayToggle,
    location,
    setLocation,
    fade,
    pageVisible,
    FADE_DURATION,
}: HeaderProps) {
    return (
        <header
            className={`mb-2 text-center transition-opacity duration-[${FADE_DURATION}ms] ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                }`}
        >

            <h1 className="text-3xl font-bold text-black dark:text-white">
                Do I Need a Coat{' '}
                <SpotlightText className="underline" onClick={handleDayToggle}>
                    {displayDay === 'today' ? 'Today' : 'Tomorrow'}
                </SpotlightText>
                ? 🧥
            </h1>

            {/* 📍 Change Location */}
            <LocationSearch location={location} setLocation={setLocation} />
        </header>
    );
}
