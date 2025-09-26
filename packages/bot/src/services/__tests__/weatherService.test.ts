import axios from 'axios';
import {jest} from '@jest/globals';
import * as weatherService from '../weatherService.js';

describe('weatherService', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
    });
    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('getCurrentWeather returns WeatherData', async () => {
        process.env.OPENWEATHER_API_KEY = 'testkey';
        jest.spyOn(axios, 'get').mockResolvedValue({
            data: {
                name: 'Rotterdam',
                sys: {country: 'NL'},
                weather: [{description: 'clear sky'}],
                main: {temp: 20, feels_like: 19, humidity: 50},
                wind: {speed: 3},
            },
        });
        const data = await weatherService.getCurrentWeather('Rotterdam');
        expect(data).toEqual({
            name: 'Rotterdam',
            country: 'NL',
            description: 'clear sky',
            temp: 20,
            feels_like: 19,
            humidity: 50,
            wind: 3,
        });
    });

    it('getCurrentWeather throws if API key missing', async () => {
        delete process.env.OPENWEATHER_API_KEY;
        await expect(weatherService.getCurrentWeather('Rotterdam')).rejects.toThrow('Weather API key is not configured.');
    });

    it('getShortTermForecast returns ForecastEntry[]', async () => {
        process.env.OPENWEATHER_API_KEY = 'testkey';
        jest.spyOn(axios, 'get').mockResolvedValue({
            data: {
                list: [
                    {
                        dt: 1700000000,
                        weather: [{main: 'Clear', description: 'clear sky'}],
                        main: {temp: 21},
                        rain: undefined,
                    },
                    {
                        dt: 1700003600,
                        weather: [{main: 'Rain', description: 'light rain'}],
                        main: {temp: 18},
                        rain: {'3h': 2},
                    },
                ],
            },
        });
        const data = await weatherService.getShortTermForecast('Rotterdam', 2);
        expect(data.length).toBe(2);
        expect(data[0]).toMatchObject({
            main: 'Clear',
            description: 'clear sky',
            temp: 21,
            emoji: '☀️',
        });
        expect(data[1]).toMatchObject({
            main: 'Rain',
            description: 'light rain',
            temp: 18,
            emoji: '🌧️',
            rain: '🌧️ 2mm',
        });
    });

    it('getShortTermForecast throws if API key missing', async () => {
        delete process.env.OPENWEATHER_API_KEY;
        await expect(weatherService.getShortTermForecast('Rotterdam', 2)).rejects.toThrow('Weather API key is not configured.');
    });

    it('getCurrentWeather handles malformed API data', async () => {
        process.env.OPENWEATHER_API_KEY = 'testkey';
        jest.spyOn(axios, 'get').mockResolvedValue({data: {}});
        await expect(weatherService.getCurrentWeather('Rotterdam')).rejects.toThrow();
    });

    it('getCurrentWeather handles API error', async () => {
        process.env.OPENWEATHER_API_KEY = 'testkey';
        jest.spyOn(axios, 'get').mockRejectedValue(new Error('api fail'));
        await expect(weatherService.getCurrentWeather('Rotterdam')).rejects.toThrow('api fail');
    });

    it('getCurrentWeather handles edge-case location', async () => {
        process.env.OPENWEATHER_API_KEY = 'testkey';
        jest.spyOn(axios, 'get').mockResolvedValue({
            data: {
                name: '',
                sys: {country: ''},
                weather: [{description: ''}],
                main: {temp: 0, feels_like: 0, humidity: 0},
                wind: {speed: 0},
            },
        });
        const data = await weatherService.getCurrentWeather('');
        expect(data.name).toBe('');
    });
});
