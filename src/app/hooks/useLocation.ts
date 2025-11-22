import { useState } from 'react';

export interface Location {
    name: string;
    latitude: number;
    longitude: number;
}

export interface Suggestion {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
}

export function useLocation() {
    const [location, setLocation] = useState<Location>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('location');
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (error) {
                console.error('Error parsing stored location:', error);
            }
        }
        return {
            name: 'Cambridge',
            latitude: 52.2053,
            longitude: 0.1218,
        };
    });

    const updateLocation = (newLoc: Location) => {
        setLocation(newLoc);
        if (typeof window !== 'undefined') {
            localStorage.setItem('location', JSON.stringify(newLoc));
        }
        window.location.reload();
    };

    return { location, updateLocation };
}
