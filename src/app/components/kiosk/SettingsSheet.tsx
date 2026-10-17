'use client';
import { useEffect } from 'react';
import { ZOOM_LEVELS } from '@/app/config';
import type { Location } from '@/app/hooks/useLocation';
import LocationSearch from '../LocationSearch';
import { eyebrow, u } from './units';

interface SettingsSheetProps {
    open: boolean;
    onClose: () => void;
    location: Location;
    setLocation: (loc: Location) => void;
    locationPinned: boolean;
    zoom: number;
    setZoom: (z: number) => void;
    zoomPinned: boolean;
}

const ZOOM_LABEL: Readonly<Record<number, string>> = { 8: 'City', 7: 'County', 6: 'Region', 5: 'Country' };

function PinnedNote() {
    return <p style={{ fontSize: u(15), color: 'var(--ink-muted)' }}>Pinned by the URL — edit the kiosk link to change it.</p>;
}

// Off-screen settings (U1): opened by `?settings` or a long-press on the
// place name, never shown otherwise. URL pins win, so pinned rows are read-only.
export default function SettingsSheet(p: SettingsSheetProps) {
    const { open, onClose } = p;
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <aside
            role="dialog"
            aria-label="Settings"
            className="kiosk-surface"
            style={{
                position: 'absolute',
                top: u(32),
                right: u(32),
                width: u(440),
                maxHeight: `calc(100% - ${u(64)})`,
                overflowY: 'auto',
                boxSizing: 'border-box',
                padding: u(32),
                borderRadius: u(28),
                display: 'flex',
                flexDirection: 'column',
                gap: u(28),
                zIndex: 30,
                // Three layers of the translucent surface: near-opaque, so the
                // nowcast card beneath doesn't read through the form.
                backgroundImage: 'linear-gradient(var(--surface), var(--surface)), linear-gradient(var(--surface), var(--surface))',
            }}
        >
            <section style={{ display: 'flex', flexDirection: 'column', gap: u(10) }}>
                <h2 style={eyebrow}>LOCATION</h2>
                <p style={{ fontSize: u(22) }}>{p.location.name}</p>
                {p.locationPinned ? (
                    <PinnedNote />
                ) : (
                    <LocationSearch
                        setLocation={(loc) => {
                            p.setLocation(loc);
                            onClose();
                        }}
                    />
                )}
            </section>
            <section style={{ display: 'flex', flexDirection: 'column', gap: u(10) }}>
                <h2 style={eyebrow}>MAP ZOOM</h2>
                <div role="radiogroup" aria-label="Map zoom" style={{ display: 'flex', gap: u(8) }}>
                    {ZOOM_LEVELS.map((z) => (
                        <button
                            key={z}
                            role="radio"
                            aria-checked={p.zoom === z}
                            disabled={p.zoomPinned}
                            onClick={() => p.setZoom(z)}
                            style={{
                                flex: 1,
                                fontSize: u(15),
                                padding: `${u(8)} 0`,
                                borderRadius: 999,
                                background: p.zoom === z ? 'var(--ok-bg)' : 'var(--card)',
                                color: p.zoom === z ? 'var(--ok-fg)' : 'var(--ink-sub)',
                                opacity: p.zoomPinned && p.zoom !== z ? 0.5 : 1,
                            }}
                        >
                            {ZOOM_LABEL[z] ?? z}
                        </button>
                    ))}
                </div>
                {p.zoomPinned && <PinnedNote />}
            </section>
            <button
                onClick={onClose}
                style={{ alignSelf: 'flex-end', fontSize: u(16), fontWeight: 600, padding: `${u(10)} ${u(22)}`, borderRadius: 999, background: 'var(--card)', color: 'var(--ink)' }}
            >
                Done
            </button>
        </aside>
    );
}
