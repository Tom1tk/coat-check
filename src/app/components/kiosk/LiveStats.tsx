'use client';
import type { PanelModel } from '@/app/utils/panelModel';
import { u } from './units';

interface Stat {
    value: string;
    unit: string;
    rain?: boolean;
}

function statsFor({ stats, change }: Pick<PanelModel, 'stats' | 'change'>): Stat[] {
    return [
        { value: `${stats.temp}°`, unit: `feels ${stats.feels}°` },
        { value: String(stats.mmNow), unit: 'mm now', rain: stats.mmNow > 0 },
        { value: String(stats.wind), unit: `mph, gusts ${stats.gusts}` },
        change ? { value: change.time, unit: change.label, rain: true } : { value: '—', unit: 'no change for 12 h' },
    ];
}

// Four live numbers between two dividers.
export default function LiveStats(props: Pick<PanelModel, 'stats' | 'change'>) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: u(12),
                padding: `${u(18)} 0`,
                borderTop: '1px solid var(--divider)',
                borderBottom: '1px solid var(--divider)',
            }}
        >
            {statsFor(props).map((s) => (
                <div key={s.unit} style={{ display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0 }}>
                    <span className="tn" style={{ fontSize: u(34), fontWeight: 300, lineHeight: 1, color: s.rain ? 'var(--pct-hi)' : 'var(--ink)' }}>
                        {s.value}
                    </span>
                    <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>{s.unit}</span>
                </div>
            ))}
        </div>
    );
}
