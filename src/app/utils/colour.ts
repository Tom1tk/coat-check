// Just enough colour maths for the mood palettes: parse #rgb/#rrggbb/rgba(),
// composite, mix, and WCAG contrast.

export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

export function parseColour(css: string): Rgba {
    const hex = css.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    const fn = css.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
    if (fn) return { r: +fn[1], g: +fn[2], b: +fn[3], a: fn[4] === undefined ? 1 : +fn[4] };
    throw new Error(`Unsupported colour: ${css}`);
}

// `top` painted over an opaque `bottom`.
export function over(top: Rgba, bottom: Rgba): Rgba {
    const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

// `weight` of `a`, the rest `b` (both opaque).
export function mix(a: Rgba, b: Rgba, weight: number): Rgba {
    return over({ ...a, a: weight }, b);
}

export function toHex({ r, g, b }: Rgba): string {
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha({ r, g, b }: Rgba, a: number): string {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function luminance({ r, g, b }: Rgba): number {
    const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// WCAG 2 contrast ratio of two opaque colours.
export function contrast(a: Rgba, b: Rgba): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
