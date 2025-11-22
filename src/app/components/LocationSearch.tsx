import React, { useState } from 'react';
import { Location, Suggestion } from '../hooks/useLocation';
import SpotlightCard from './SpotlightCard';
import SpotlightText from './SpotlightText';

interface LocationSearchProps {
    location: Location;
    setLocation: (loc: Location) => void;
}

export default function LocationSearch({ location, setLocation }: LocationSearchProps) {
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    return (
        <div className="mt-2 flex flex-col text-black items-center">
            <button
                onClick={() => setSearchVisible(!searchVisible)}
                className="hover:text-grey"
            >
                <SpotlightText className="underline">
                    📍 Current Location - {location.name}
                </SpotlightText>
            </button>

            {searchVisible && (
                <SpotlightCard className="mt-2 flex flex-col items-center glass-panel p-3 rounded-xl w-64">
                    <input
                        type="text"
                        placeholder="Enter city name..."
                        value={searchQuery}
                        onChange={async (e) => {
                            setSearchQuery(e.target.value);
                            setErrorMessage('');
                            if (e.target.value.length < 2) {
                                setSuggestions([]);
                                return;
                            }
                            try {
                                const res = await fetch(
                                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                                        e.target.value
                                    )}&count=5`
                                );
                                const data = await res.json();
                                if (data.results) setSuggestions(data.results);
                                else setSuggestions([]);
                            } catch (err) {
                                console.error(err);
                                setSuggestions([]);
                            }
                        }}
                        className="border border-gray-300 rounded-md p-2 w-full"
                    />

                    {/* Suggestions dropdown */}
                    {suggestions.length > 0 && (
                        <ul className="mt-1 max-h-40 overflow-y-auto w-full border border-gray-300 rounded-md bg-white">
                            {suggestions.map((s, i) => (
                                <li
                                    key={i}
                                    className="p-2 cursor-pointer hover:bg-blue-100"
                                    onClick={() => {
                                        const newLoc = {
                                            name: s.name,
                                            latitude: s.latitude,
                                            longitude: s.longitude,
                                        };
                                        setLocation(newLoc);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('location', JSON.stringify(newLoc));
                                        }
                                        window.location.reload();
                                    }}
                                >
                                    {s.name}, {s.country}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Manual search button & error message */}
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
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('location', JSON.stringify(newLoc));
                                    }
                                    window.location.reload();
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
                        className="bg-blue-500 hover:bg-blue-600 text-black font-semibold py-1 px-3 rounded-md mt-2"
                    >
                        {loadingLocation ? 'Searching...' : 'Search'}
                    </button>
                    {errorMessage && <p className="text-red-600 mt-1 text-sm">{errorMessage}</p>}
                </SpotlightCard>
            )}
        </div>
    );
}
