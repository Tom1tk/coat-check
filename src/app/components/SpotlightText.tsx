'use client';
import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

interface SpotlightTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode;
    className?: string;
    spotlightColor?: string;
    baseColor?: string;
    spotlightSize?: number;
}

export default function SpotlightText({
    children,
    className = '',
    spotlightColor,
    baseColor,
    spotlightSize = 60,
    ...props
}: SpotlightTextProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === 'dark';

    const defaultBaseColor = isDark ? '#ffffff' : '#000000';
    const defaultSpotlightColor = isDark ? '#a0a0a0' : '#898989ff';

    const finalBaseColor = baseColor || defaultBaseColor;
    const finalSpotlightColor = spotlightColor || defaultSpotlightColor;

    const spanRef = useRef<HTMLSpanElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLSpanElement>) => {
        if (!spanRef.current) return;
        const rect = spanRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    return (
        <span
            ref={spanRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative inline-block cursor-pointer ${className}`}
            style={{
                color: 'transparent',
                textDecorationColor: finalBaseColor,
                backgroundImage: isHovered
                    ? `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${finalSpotlightColor}, ${finalBaseColor})`
                    : `linear-gradient(${finalBaseColor}, ${finalBaseColor})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                // Note: Transitions on background-image are not fully supported in all browsers, 
                // but this prevents the "flash" by keeping the text transparent and clipping active.
            }}
            {...props}
        >
            {children}
        </span>
    );
}
