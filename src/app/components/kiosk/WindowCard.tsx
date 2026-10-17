'use client';
import WeatherIcon from '../WeatherIcon';
import type { PanelCard } from '@/app/utils/panelModel';
import { u } from './units';

const KIND = {
    coat: { card: 'var(--coat-card)', tagBg: 'var(--coat-bg)', tagFg: 'var(--coat-fg)' },
    ok: { card: 'var(--card)', tagBg: 'var(--ok-bg)', tagFg: 'var(--ok-fg)' },
} as const;

// One commute window: label and range, icon, temperature, the rain/wind line
// and that window's own verdict tag. Compact (portrait) puts the tag beside
// the temperature, saving a row.
export default function WindowCard({ card, compact = false }: { card: PanelCard; compact?: boolean }) {
    const kind = KIND[card.kind];
    const tag = (
        <span style={{ alignSelf: compact ? 'center' : 'flex-start', fontSize: u(13), fontWeight: 600, padding: `${u(4)} ${u(10)}`, borderRadius: 999, background: kind.tagBg, color: kind.tagFg, whiteSpace: 'nowrap' }}>
            {card.tag}
        </span>
    );
    const temp = (
        <span className="tn" style={{ fontSize: u(compact ? 32 : 40), fontWeight: 300, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {card.temp}°<span style={{ fontSize: u(compact ? 15 : 17), color: 'var(--ink-muted)' }}> feels {card.feels}°</span>
        </span>
    );
    return (
        <div
            style={{
                padding: compact ? `${u(12)} ${u(16)}` : `${u(16)} ${u(18)}`,
                borderRadius: u(compact ? 16 : 18),
                background: kind.card,
                display: 'flex',
                flexDirection: 'column',
                gap: u(compact ? 6 : 8),
                minWidth: 0,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: u(14), fontWeight: 600, color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                    {card.label}{' '}
                    <span className="tn" style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>
                        {card.range}
                    </span>
                </span>
                <WeatherIcon code={card.code} size={u(compact ? 22 : 26)} />
            </div>
            {compact ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: u(8), flexWrap: 'wrap' }}>
                    {temp}
                    {tag}
                </div>
            ) : (
                temp
            )}
            <span className="tn" style={{ fontSize: u(compact ? 14 : 15), color: 'var(--ink-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {card.line}
            </span>
            {!compact && tag}
        </div>
    );
}
