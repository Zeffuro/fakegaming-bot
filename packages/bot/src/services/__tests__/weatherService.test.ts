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

        it('should throw error when API key is missing', async () => {
            delete process.env.OPENWEATHER_API_KEY;

            await expect(getCurrentWeather('London')).rejects.toThrow(
                'Weather API key is not configured'
            );
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
                rain: '🌧️ 2.5mm',
                emoji: '🌧️',
            });
            expect(result[1]).toMatchObject({
                main: 'Clear',
                temp: 22.0,
                rain: '',
                emoji: '☀️',
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
    });
});

