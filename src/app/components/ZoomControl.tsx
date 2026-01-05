import React from 'react';
import SpotlightCard from './SpotlightCard';

interface ZoomControlProps {
    currentZoom: number;
    onZoomChange: (zoom: number) => void;
}

export default function ZoomControl({ currentZoom, onZoomChange }: ZoomControlProps) {
    // Zoom levels: 8 (Zoomed In, Left) -> 5 (Zoomed Out, Right)
    // Smallest bar on left (Zoom 8) -> Largest bar on right (Zoom 5)
    const zoomLevels = [8, 7, 6, 5];

    return (
        <SpotlightCard className="glass-panel flex items-end gap-2 px-3 py-2 rounded-xl mb-2">
            {zoomLevels.map((level, index) => {
                // New height calculation:
                // Smallest (Index 0) doubled from 7 -> 14
                // Largest (Index 3) remains 22
                // Steps: (22 - 14) / 3 = 2.666...
                const height = 14 + (index * 8) / 3;
                const isActive = currentZoom === level;

                return (
                    <button
                        key={level}
                        onClick={() => onZoomChange(level)}
                        className={`w-2 rounded-full transition-all duration-300 ${isActive
                            ? 'bg-white/30 ring-1 ring-inset ring-white/60' // Glass + "shine" stroke
                            : 'bg-black/30 hover:bg-black/20' // Transparent unselected
                            }`}
                        style={{ height: `${height}px` }}
                        aria-label={`Set Zoom Level to ${level}`}
                    />
                );
            })}
        </SpotlightCard>
    );
}
