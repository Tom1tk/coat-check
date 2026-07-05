import { NextRequest } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
    const { z, x, y } = await params;

    // Validate: small non-negative integers only (z 0-22, x/y within 2^z)
    const zi = Number(z), xi = Number(x), yi = Number(y);
    if (
        !Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi) ||
        zi < 0 || zi > 22 || xi < 0 || yi < 0 || xi >= 2 ** zi || yi >= 2 ** zi
    ) {
        return new Response('Invalid tile coordinates', { status: 400 });
    }

    const apiKey = process.env.OWM_API_KEY;
    if (!apiKey) {
        console.error('[rain-tiles] OWM_API_KEY is not set');
        return new Response('Server misconfigured', { status: 500 });
    }

    const upstream = await fetch(
        `https://tile.openweathermap.org/map/precipitation_new/${zi}/${xi}/${yi}.png?appid=${apiKey}`
    );
    if (!upstream.ok) {
        return new Response('Upstream tile error', { status: 502 });
    }

    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'image/png',
            // Cache on the CDN; rain data updates every ~10 min upstream.
            'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=600',
        },
    });
}
