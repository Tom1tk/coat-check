'use client';
import React, { useRef, useState, useCallback } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    spotlightColor?: string;
    spotlightSize?: number;
}

export default function SpotlightCard({
    children,
    className = '',
    spotlightColor = 'rgba(255, 255, 255, 0.9)',
    spotlightSize = 400,
    ...props
}: SpotlightCardProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);
    const rafRef = useRef<number | null>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;

        // Throttle with requestAnimationFrame
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            if (divRef.current) {
                const rect = divRef.current.getBoundingClientRect();
                setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
            rafRef.current = null;
        });
    }, []);

    const handleMouseEnter = () => setOpacity(1);
    const handleMouseLeave = () => setOpacity(0);

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${className}`}
            {...props}
        >
            {/* Spotlight Border */}
            <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] z-50 transition-opacity duration-500"
                style={{
                    opacity,
                    background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    padding: '1px',
                }}
            />
            {children}
        </div>
    );
}
