'use client';
import type { PanelModel } from '@/app/utils/panelModel';
import { clock12, hour12 } from '@/app/utils/twelveHour';
import { u } from './units';

interface Stat {
    value: string;
    unit: string;
    rain?: boolean;
}

// "15:00" → "3pm", so four columns fit the slim panel; "15:30" → "3:30pm".
const shortTime = (hhmm: string) => (hhmm.endsWith(':00') ? hour12(Number(hhmm.slice(0, 2))) : clock12(hhmm));

function statsFor({ stats, change }: Pick<PanelModel, 'stats' | 'change'>): Stat[] {
    return [
        { value: `${stats.temp}°`, unit: `feels ${stats.feels}°` },
        { value: String(stats.mmNow), unit: 'mm now', rain: stats.mmNow > 0 },
        { value: String(stats.wind), unit: `mph, gust ${stats.gusts}` },
        change ? { value: shortTime(change.time), unit: change.label, rain: true } : { value: '—', unit: 'no change for 12 h' },
    ];
}

// Four live numbers between two dividers.
export default function LiveStats(props: Pick<PanelModel, 'stats' | 'change'>) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: u(10),
                padding: `${u(14)} 0`,
                borderTop: '1px solid var(--divider)',
                borderBottom: '1px solid var(--divider)',
            }}
        >
            {statsFor(props).map((s) => (
                <div key={s.unit} style={{ display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0 }}>
                    <span className="tn" style={{ fontSize: u(30), fontWeight: 300, lineHeight: 1, color: s.rain ? 'var(--pct-hi)' : 'var(--ink)' }}>
                        {s.value}
                    </span>
                    <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>{s.unit}</span>
                </div>
            ))}
        </div>
    );
}
