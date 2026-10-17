import React, { useState, useRef, useCallback, useEffect } from 'react';
import { u } from './kiosk/units';
import { Location, Suggestion } from '../hooks/useLocation';
import { Loader2 } from 'lucide-react';

interface LocationSearchProps {
    setLocation: (loc: Location) => void;
}

// City search for the settings sheet: debounced suggestions, then Submit
// geocodes the query and hands the place to `setLocation`.
export default function LocationSearch({ setLocation }: LocationSearchProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Debounce timer ref
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks the in-flight suggestion fetch so a superseded request can be cancelled
    const abortRef = useRef<AbortController | null>(null);

    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            abortRef.current?.abort();
            setSuggestions([]);
            setActiveIndex(-1);
            return;
        }
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`,
                { signal: controller.signal }
            );
            const data = await res.json();
            if (data.results) setSuggestions(data.results);
            else setSuggestions([]);
            setActiveIndex(-1);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error(err);
            setSuggestions([]);
            setActiveIndex(-1);
        }
    }, []);

    // Clear the debounce timer and abort any in-flight request on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            abortRef.current?.abort();
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        setErrorMessage('');

        // Clear any existing debounce timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new debounce timer (300ms)
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);
    };

    const selectSuggestion = (s: Suggestion) => {
        setSearchQuery(`${s.name}, ${s.country}`);
        setSuggestions([]);
        setActiveIndex(-1);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                selectSuggestion(suggestions[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            setSuggestions([]);
            setActiveIndex(-1);
        }
    };

    const submit = async () => {
        if (!searchQuery) return;
        setLoadingLocation(true);
        try {
            const res = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1`
            );
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const loc = data.results[0];
                setLocation({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude });
            } else {
                setErrorMessage('Location not found. Try another search.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Error fetching location data.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const field: React.CSSProperties = {
        width: '100%',
        boxSizing: 'border-box',
        fontSize: u(18),
        padding: `${u(10)} ${u(14)}`,
        borderRadius: u(12),
        border: '1px solid var(--divider)',
        background: 'var(--card)',
        color: 'var(--ink)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(8) }}>
            <label htmlFor="location-search" className="sr-only">
                Search for a city
            </label>
            <input
                id="location-search"
                name="location"
                type="text"
                placeholder="Enter city name…"
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls="location-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? `location-option-${activeIndex}` : undefined}
                style={field}
            />

            {suggestions.length > 0 && (
                <ul id="location-suggestions" role="listbox" style={{ ...field, padding: u(4), listStyle: 'none', margin: 0 }}>
                    {suggestions.map((s, i) => (
                        <li
                            key={i}
                            id={`location-option-${i}`}
                            role="option"
                            aria-selected={i === activeIndex}
                            onClick={() => selectSuggestion(s)}
                            style={{
                                cursor: 'pointer',
                                padding: `${u(8)} ${u(10)}`,
                                borderRadius: u(8),
                                background: i === activeIndex ? 'var(--today-tint)' : 'transparent',
                            }}
                        >
                            {s.name}, {s.country}
                        </li>
                    ))}
                </ul>
            )}

            <button
                onClick={submit}
                style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: u(8),
                    fontSize: u(16),
                    fontWeight: 600,
                    padding: `${u(8)} ${u(16)}`,
                    borderRadius: 999,
                    background: 'var(--ok-bg)',
                    color: 'var(--ok-fg)',
                }}
            >
                {loadingLocation && <Loader2 className="animate-spin" style={{ width: u(16), height: u(16) }} aria-hidden="true" />}
                {loadingLocation ? 'Submitting…' : 'Submit'}
            </button>
            {errorMessage && (
                <p role="alert" style={{ fontSize: u(14), color: 'var(--accent-coat)' }}>
                    {errorMessage}
                </p>
            )}
        </div>
    );
}
