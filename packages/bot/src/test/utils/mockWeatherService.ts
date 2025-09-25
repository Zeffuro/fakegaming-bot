import {jest} from '@jest/globals';
import type {WeatherData, ForecastEntry} from '../../services/weatherService.js';

const getCurrentWeatherMock = jest.fn<(
    location: string
) => Promise<WeatherData>>();
const getShortTermForecastMock = jest.fn<(
    location: string,
    hours: number
) => Promise<ForecastEntry[]>>();

jest.unstable_mockModule('../../services/weatherService.js', () => ({
    getCurrentWeather: getCurrentWeatherMock,
    getShortTermForecast: getShortTermForecastMock
}));

export function resetWeatherMocks() {
    getCurrentWeatherMock.mockReset();
    getShortTermForecastMock.mockReset();
}

export {
    getCurrentWeatherMock,
    getShortTermForecastMock
};

