import {
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudHail,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
    CloudSunRain,
    Sun,
    type LucideIcon,
} from 'lucide-react';
import { describeCode, type IconKey } from '@/app/utils/weatherCodes';

// The one place weather codes become pictures.
const ICONS: Readonly<Record<IconKey, LucideIcon>> = {
    sun: Sun,
    'cloud-sun': CloudSun,
    cloud: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    rain: CloudRain,
    showers: CloudSunRain,
    snow: CloudSnow,
    sleet: CloudHail,
    thunder: CloudLightning,
};

function colourFor(icon: IconKey, wet: boolean): string {
    if (wet) return 'var(--rain-icon)';
    return icon === 'sun' || icon === 'cloud-sun' ? 'var(--sun-icon)' : 'var(--icon)';
}

export default function WeatherIcon({ code, size, strokeWidth = 1.6 }: { code: number; size: string; strokeWidth?: number }) {
    const condition = describeCode(code);
    const Icon = ICONS[condition.icon];
    return (
        <Icon
            aria-label={condition.label}
            role="img"
            strokeWidth={strokeWidth}
            style={{ width: size, height: size, color: colourFor(condition.icon, condition.wet), flexShrink: 0 }}
        />
    );
}
