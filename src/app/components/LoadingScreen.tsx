import React from 'react';

interface LoadingScreenProps {
    visible: boolean;
    FADE_DURATION: number;
}

export default function LoadingScreen({ visible, FADE_DURATION }: LoadingScreenProps) {
    return (
        <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-200 to-blue-300 text-black z-50 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'
                }`}
            style={{ transitionDuration: `${FADE_DURATION}ms` }}
        >
            <p className="text-2xl font-semibold animate-pulse">Loading weather data...</p>
        </div>
    );
}
