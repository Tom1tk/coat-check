'use client';
import type { Verdict as VerdictKind } from '@/app/utils/coatAdvice';
import { eyebrow, u } from './units';

const COAT_VERDICTS: readonly VerdictKind[] = ['coat-on', 'coat-in-bag'];

// "LEAVING NOW" → the serif verdict → one reason line. The accent colour
// marks any verdict that involves a coat.
export default function Verdict({
    heading,
    verdict,
    text,
    reason,
    compact = false,
}: {
    heading: string;
    verdict: VerdictKind;
    text: string;
    reason: string;
    compact?: boolean;
}) {
    const coat = COAT_VERDICTS.includes(verdict);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(compact ? 4 : 6) }}>
            <span style={eyebrow}>{heading}</span>
            <h1
                style={{
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    fontSize: u(compact ? 62 : 92),
                    lineHeight: 0.95,
                    letterSpacing: u(-1),
                    color: coat ? 'var(--accent-coat)' : 'var(--ink)',
                }}
            >
                {text}
            </h1>
            <p className="tn" style={{ margin: `${u(compact ? 2 : 6)} 0 0 0`, fontSize: u(compact ? 16 : 19), lineHeight: 1.4, color: 'var(--ink-sub)' }}>
                {reason}
            </p>
        </div>
    );
}
