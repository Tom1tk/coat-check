'use client';
import WeatherIcon from '../WeatherIcon';
import type { PanelCard } from '@/app/utils/panelModel';
import { u } from './units';

const KIND = {
    coat: { card: 'var(--coat-card)', tagBg: 'var(--coat-bg)', tagFg: 'var(--coat-fg)' },
    ok: { card: 'var(--card)', tagBg: 'var(--ok-bg)', tagFg: 'var(--ok-fg)' },
} as const;

// One commute window: label and range, icon, temperature, the rain/wind line
// and that window's own verdict tag.
export default function WindowCard({ card }: { card: PanelCard }) {
    const kind = KIND[card.kind];
    return (
        <div style={{ padding: `${u(16)} ${u(18)}`, borderRadius: u(18), background: kind.card, display: 'flex', flexDirection: 'column', gap: u(8), minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: u(14), fontWeight: 600, color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                    {card.label}{' '}
                    <span className="tn" style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>
                        {card.range}
                    </span>
                </span>
                <WeatherIcon code={card.code} size={u(26)} />
            </div>
            <span className="tn" style={{ fontSize: u(40), fontWeight: 300, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {card.temp}°<span style={{ fontSize: u(17), color: 'var(--ink-muted)' }}> feels {card.feels}°</span>
            </span>
            <span className="tn" style={{ fontSize: u(15), color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                {card.line}
            </span>
            <span style={{ alignSelf: 'flex-start', fontSize: u(13), fontWeight: 600, padding: `${u(4)} ${u(10)}`, borderRadius: 999, background: kind.tagBg, color: kind.tagFg }}>
                {card.tag}
            </span>
        </div>
    );
}
