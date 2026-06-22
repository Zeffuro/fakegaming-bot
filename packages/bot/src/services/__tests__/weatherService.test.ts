import { describe, it, expect, beforeEach, vi } from 'vitest';

const axiosMocks = vi.hoisted(() => {
    const get = vi.fn();
    return {
        create: vi.fn(() => ({get})),
        get,
    };
});

vi.mock('axios', () => ({
    default: {
        create: axiosMocks.create,
    },
}));

import {
    clearWeatherServiceCaches,
    getCurrentWeather,
    getShortTermForecast,
} from '../weatherService.js';

describe('weatherService', () => {
    beforeEach(() => {
        axiosMocks.get.mockReset();
        clearWeatherServiceCaches();
        process.env.OPENWEATHER_API_KEY = 'test-api-key';
    });

    it('should configure a weather HTTP timeout', async () => {
        axiosMocks.create.mockClear();
        vi.resetModules();
        await import('../weatherService.js');

        expect(axiosMocks.create).toHaveBeenCalledWith({timeout: 5000});
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

            axiosMocks.get.mockResolvedValue(mockResponse);

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

            expect(axiosMocks.get).toHaveBeenCalledWith(
                expect.stringContaining('q=London')
            );
        });

        it('should throw error for malformed API response', async () => {
            axiosMocks.get.mockResolvedValue({ data: {} });

            await expect(getCurrentWeather('Invalid')).rejects.toThrow(
                'Malformed weather API response'
            );
        });

        it('should use Open-Meteo fallback when API key is missing', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            axiosMocks.get
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
            expect(axiosMocks.get).toHaveBeenCalledWith(expect.stringContaining('geocoding-api.open-meteo.com'));
            expect(axiosMocks.get).toHaveBeenCalledWith(expect.stringContaining('api.open-meteo.com'));
        });

        it('should fall back to Open-Meteo when OpenWeather is unavailable', async () => {
            const networkError = new Error('Network Error');
            (networkError as any).isAxiosError = true;
            axiosMocks.get
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
            expect(axiosMocks.get).toHaveBeenCalledTimes(3);
        });

        it('should surface location-not-found from Open-Meteo fallback', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            axiosMocks.get.mockResolvedValue({ data: { results: [] } });

            await expect(getCurrentWeather('NotARealPlace')).rejects.toMatchObject({
                response: { status: 404 },
            });
        });

        it('should reuse cached current weather by normalized location', async () => {
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

            axiosMocks.get.mockResolvedValue(mockResponse);

            const first = await getCurrentWeather('London');
            const second = await getCurrentWeather(' london ');

            expect(second).toEqual(first);
            expect(axiosMocks.get).toHaveBeenCalledTimes(1);
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

            axiosMocks.get.mockResolvedValue(mockResponse);

            const result = await getShortTermForecast('London', 2);
            const expectedTime = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                weekday: 'short',
                hour12: false,
                timeZone: 'UTC',
            }).format(new Date(1696780800 * 1000));

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                time: expectedTime,
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

            axiosMocks.get.mockResolvedValue(mockResponse);

            const result = await getShortTermForecast('London');

            expect(result).toHaveLength(4);
        });

        it('should use Open-Meteo fallback when API key is missing', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            axiosMocks.get
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

        it('should reuse cached Open-Meteo forecast lookups by normalized location and period count', async () => {
            delete process.env.OPENWEATHER_API_KEY;
            axiosMocks.get
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
                            time: ['2026-06-22T12:00', '2026-06-22T15:00'],
                            temperature_2m: [18.4, 19.1],
                            precipitation: [0, 1.5],
                            weather_code: [0, 61],
                        },
                    },
                });

            const first = await getShortTermForecast('Rotterdam', 2);
            const second = await getShortTermForecast(' rotterdam ', 2);

            expect(second).toEqual(first);
            expect(axiosMocks.get).toHaveBeenCalledTimes(2);
        });
    });
});

