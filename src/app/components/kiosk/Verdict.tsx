'use client';
import type { Verdict as VerdictKind } from '@/app/utils/coatAdvice';
import { eyebrow, u } from './units';

const COAT_VERDICTS: readonly VerdictKind[] = ['coat-on', 'coat-in-bag'];

// "TODAY" → the serif verdict. The accent colour marks any verdict that
// involves a coat; the numbers behind it are the live stats and the cards.
export default function Verdict({
    heading,
    verdict,
    text,
    compact = false,
}: {
    heading: string;
    verdict: VerdictKind;
    text: string;
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
                    fontSize: u(compact ? 62 : 84),
                    lineHeight: 0.95,
                    letterSpacing: u(-1),
                    color: coat ? 'var(--accent-coat)' : 'var(--ink)',
                }}
            >
                {text}
            </h1>
        </div>
    );
}
