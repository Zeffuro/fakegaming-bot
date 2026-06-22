import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');

import { getCurrentWeather, getShortTermForecast } from '../weatherService.js';

describe('weatherService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENWEATHER_API_KEY = 'test-api-key';
    });

    describe('getCurrentWeather', () => {
        it('should fetch and parse current weather data', async () => {
            const mockResponse = {
                data: {
                    name: 'London',
                    sys: { country: 'GB' },
                    weather: [{ description: 'clear sky' }],
                    main: {
                        temp: 20.5,
                        feels_like: 19.8,
                        humidity: 65,
                    },
                    wind: { speed: 5.2 },
                },
            };

            vi.mocked(axios.get).mockResolvedValue(mockResponse);

            const result = await getCurrentWeather('London');

            expect(result).toEqual({
                name: 'London',
                country: 'GB',
                description: 'clear sky',
                temp: 20.5,
                feels_like: 19.8,
                humidity: 65,
                wind: 5.2,
            });

            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('q=London')
            );
        });

        it('should throw error for malformed API response', async () => {
            vi.mocked(axios.get).mockResolvedValue({ data: {} });

            await expect(getCurrentWeather('Invalid')).rejects.toThrow(
                'Malformed weather API response'
            );
        });

        it('should use Open-Meteo fallback when API key is missing', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            vi.mocked(axios.get)
                .mockResolvedValueOnce({
                    data: {
                        results: [
                            { name: 'Rotterdam', country_code: 'NL', latitude: 51.92, longitude: 4.48 },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    data: {
                        current: {
                            temperature_2m: 18.4,
                            apparent_temperature: 17.9,
                            relative_humidity_2m: 72,
                            wind_speed_10m: 12.2,
                            weather_code: 2,
                        },
                    },
                });

            const result = await getCurrentWeather('Rotterdam');

            expect(result).toEqual({
                name: 'Rotterdam',
                country: 'NL',
                description: 'partly cloudy',
                temp: 18.4,
                feels_like: 17.9,
                humidity: 72,
                wind: 12.2,
            });
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('geocoding-api.open-meteo.com'));
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.open-meteo.com'));
        });

        it('should fall back to Open-Meteo when OpenWeather is unavailable', async () => {
            const networkError = new Error('Network Error');
            (networkError as any).isAxiosError = true;
            vi.mocked(axios.get)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce({
                    data: {
                        results: [
                            { name: 'Rotterdam', country_code: 'NL', latitude: 51.92, longitude: 4.48 },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    data: {
                        current: {
                            temperature_2m: 18.4,
                            apparent_temperature: 17.9,
                            relative_humidity_2m: 72,
                            wind_speed_10m: 12.2,
                            weather_code: 61,
                        },
                    },
                });

            const result = await getCurrentWeather('Rotterdam');

            expect(result.description).toBe('rain');
            expect(axios.get).toHaveBeenCalledTimes(3);
        });

        it('should surface location-not-found from Open-Meteo fallback', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            vi.mocked(axios.get).mockResolvedValue({ data: { results: [] } });

            await expect(getCurrentWeather('NotARealPlace')).rejects.toMatchObject({
                response: { status: 404 },
            });
        });
    });

    describe('getShortTermForecast', () => {
        it('should fetch and parse forecast data', async () => {
            const mockResponse = {
                data: {
                    list: [
                        {
                            dt: 1696780800,
                            weather: [{ main: 'Rain', description: 'light rain' }],
                            main: { temp: 18.5 },
                            rain: { '3h': 2.5 },
                        },
                        {
                            dt: 1696791600,
                            weather: [{ main: 'Clear', description: 'clear sky' }],
                            main: { temp: 22.0 },
                        },
                    ],
                },
            };

            vi.mocked(axios.get).mockResolvedValue(mockResponse);

            const result = await getShortTermForecast('London', 2);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                main: 'Rain',
                description: 'light rain',
                temp: 18.5,
                rain: '\ud83c\udf27\ufe0f 2.5mm',
                emoji: '\ud83c\udf27\ufe0f',
            });
            expect(result[1]).toMatchObject({
                main: 'Clear',
                temp: 22.0,
                rain: '',
                emoji: '\u2600\ufe0f',
            });
        });

        it('should default to 4 periods if not specified', async () => {
            const mockResponse = {
                data: {
                    list: Array(10).fill({
                        dt: 1696780800,
                        weather: [{ main: 'Clear', description: 'clear' }],
                        main: { temp: 20 },
                    }),
                },
            };

            vi.mocked(axios.get).mockResolvedValue(mockResponse);

            const result = await getShortTermForecast('London');

            expect(result).toHaveLength(4);
        });

        it('should use Open-Meteo fallback when API key is missing', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            vi.mocked(axios.get)
                .mockResolvedValueOnce({
                    data: {
                        results: [
                            { name: 'Rotterdam', country_code: 'NL', latitude: 51.92, longitude: 4.48 },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    data: {
                        hourly: {
                            time: ['2026-06-22T12:00', '2026-06-22T15:00', '2026-06-22T18:00'],
                            temperature_2m: [18.4, 19.1, 17.2],
                            precipitation: [0, 1.5, 0],
                            weather_code: [0, 61, 3],
                        },
                    },
                });

            const result = await getShortTermForecast('Rotterdam', 2);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                main: 'Clear',
                description: 'clear sky',
                temp: 18.4,
                rain: '',
                emoji: '\u2600\ufe0f',
            });
            expect(result[1]).toMatchObject({
                main: 'Rain',
                description: 'rain',
                temp: 19.1,
                rain: '\ud83c\udf27\ufe0f 1.5mm',
                emoji: '\ud83c\udf27\ufe0f',
            });
        });
    });
});

