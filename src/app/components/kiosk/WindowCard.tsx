'use client';
import type { ReactNode } from 'react';
import WeatherIcon from '../WeatherIcon';
import type { PanelCard } from '@/app/utils/panelModel';
import { u } from './units';

const KIND = {
    coat: { card: 'var(--coat-card)', tagBg: 'var(--coat-bg)', tagFg: 'var(--coat-fg)' },
    ok: { card: 'var(--card)', tagBg: 'var(--ok-bg)', tagFg: 'var(--ok-fg)' },
} as const;

// One window: label and range, icon, temperature, the rain/wind line and
// that window's own verdict tag. A lone card (the whole day) puts a large
// icon beside the text; side-by-side Out/Back cards keep the icon in the
// label row, since they are half as wide. Compact is portrait.
export default function WindowCard({ card, single = false, compact = false }: { card: PanelCard; single?: boolean; compact?: boolean }) {
    const kind = KIND[card.kind];
    const label = (
        <span style={{ fontSize: u(14), fontWeight: 600, color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
            {card.label}{' '}
            <span className="tn" style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>
                {card.range}
            </span>
        </span>
    );
    const body: ReactNode = (
        <>
            <span className="tn" style={{ fontSize: u(compact ? 32 : 40), fontWeight: 300, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {card.temp}°<span style={{ fontSize: u(compact ? 16 : single ? 20 : 17), color: 'var(--ink-muted)' }}> {card.sub}</span>
            </span>
            <span className="tn" style={{ fontSize: u(compact ? 14 : 15), color: 'var(--ink-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {card.line}
            </span>
            <span style={{ alignSelf: 'flex-start', fontSize: u(13), fontWeight: 600, padding: `${u(4)} ${u(10)}`, borderRadius: 999, background: kind.tagBg, color: kind.tagFg, whiteSpace: 'nowrap' }}>
                {card.tag}
            </span>
        </>
    );
    const frame = {
        padding: compact ? `${u(12)} ${u(16)}` : `${u(16)} ${u(18)}`,
        borderRadius: u(compact ? 16 : 18),
        background: kind.card,
        display: 'flex',
        minWidth: 0,
    } as const;
    if (single) {
        return (
            <div style={{ ...frame, alignItems: 'center', gap: u(18) }}>
                <WeatherIcon code={card.code} size={u(compact ? 40 : 44)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: u(6), minWidth: 0, flex: '1 1 0' }}>
                    {label}
                    {body}
                </div>
            </div>
        );
    }
    return (
        <div style={{ ...frame, flexDirection: 'column', gap: u(compact ? 6 : 8) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {label}
                <WeatherIcon code={card.code} size={u(compact ? 22 : 26)} />
            </div>
            {body}
        </div>
    );
}
