import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Location, Suggestion } from '../hooks/useLocation';
import SpotlightCard from './SpotlightCard';
import SpotlightText from './SpotlightText';
import { Loader2 } from 'lucide-react';

interface LocationSearchProps {
    location: Location;
    setLocation: (loc: Location) => void;
}

export default function LocationSearch({ location, setLocation }: LocationSearchProps) {
    const [searchVisible, setSearchVisible] = useState(false);
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

    return (
        <div className="mt-2 flex flex-col text-black items-center">
            <button
                onClick={() => setSearchVisible(!searchVisible)}
                className="hover:text-grey focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 rounded"
            >
                <SpotlightText className="underline">
                    📍 Current Location - {location.name}
                </SpotlightText>
            </button>

            {searchVisible && (
                <SpotlightCard className="mt-2 flex flex-col items-center glass-panel p-3 rounded-xl w-64">
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
                        className="border border-gray-300 rounded-md p-2 w-full focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:border-transparent"
                    />

                    {/* Suggestions dropdown */}
                    {suggestions.length > 0 && (
                        <ul id="location-suggestions" className="mt-1 max-h-40 overflow-y-auto w-full border border-gray-300 rounded-md bg-white" role="listbox">
                            {suggestions.map((s, i) => (
                                <li
                                    key={i}
                                    id={`location-option-${i}`}
                                    role="option"
                                    aria-selected={i === activeIndex}
                                    className={`p-2 cursor-pointer hover:bg-blue-100 focus-visible:bg-blue-100 focus-visible:outline-none ${i === activeIndex ? 'bg-blue-100' : ''}`}
                                    onClick={() => {
                                        // Just update the search box, don't submit yet
                                        selectSuggestion(s);
                                    }}
                                >
                                    {s.name}, {s.country}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Manual submit button & error message */}
                    <button
                        onClick={async () => {
                            if (!searchQuery) return;
                            setLoadingLocation(true);
                            try {
                                const res = await fetch(
                                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                                        searchQuery
                                    )}&count=1`
                                );
                                const data = await res.json();
                                if (data.results && data.results.length > 0) {
                                    const loc = data.results[0];
                                    const newLoc = {
                                        name: loc.name,
                                        latitude: loc.latitude,
                                        longitude: loc.longitude,
                                    };
                                    setLocation(newLoc);
                                    // Close the search UI
                                    setSearchVisible(false);
                                } else {
                                    setErrorMessage('Location not found. Try another search.');
                                }
                            } catch (err) {
                                console.error(err);
                                setErrorMessage('Error fetching location data.');
                            } finally {
                                setLoadingLocation(false);
                            }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-black font-semibold py-1 px-3 rounded-md mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 flex items-center gap-2"
                    >
                        {loadingLocation && (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        )}
                        {loadingLocation ? 'Submitting…' : 'Submit'}
                    </button>
                    {errorMessage && <p className="text-red-600 mt-1 text-sm" role="alert">{errorMessage}</p>}
                </SpotlightCard>
            )}
        </div>
    );
}

