import axios from 'axios';

export interface WeatherData {
    name: string;
    country: string;
    description: string;
    temp: number;
    feels_like: number;
    humidity: number;
    wind: number;
}

export interface ForecastEntry {
    time: string;
    main: string;
    description: string;
    temp: number;
    rain: string;
    emoji: string;
}

interface OpenWeatherCurrentResponse {
    name?: unknown;
    sys?: { country?: unknown };
    weather?: { description?: unknown }[];
    main?: {
        temp?: unknown;
        feels_like?: unknown;
        humidity?: unknown;
    };
    wind?: { speed?: unknown };
}

interface OpenWeatherForecastEntry {
    dt?: unknown;
    weather?: { main?: unknown; description?: unknown }[];
    main?: { temp?: unknown };
    rain?: { '3h'?: unknown };
}

interface OpenWeatherForecastResponse {
    list?: unknown;
}

interface OpenMeteoGeocodingResponse {
    results?: unknown;
}

interface OpenMeteoGeocodingResult {
    name?: unknown;
    country_code?: unknown;
    latitude?: unknown;
    longitude?: unknown;
}

interface OpenMeteoForecastResponse {
    current?: {
        temperature_2m?: unknown;
        apparent_temperature?: unknown;
        relative_humidity_2m?: unknown;
        wind_speed_10m?: unknown;
        weather_code?: unknown;
    };
    hourly?: {
        time?: unknown;
        temperature_2m?: unknown;
        precipitation?: unknown;
        weather_code?: unknown;
    };
}

interface OpenMeteoLocation {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
}

const rainEmoji = '\uD83C\uDF27\uFE0F';
const snowEmoji = '\u2744\uFE0F';
const clearEmoji = '\u2600\uFE0F';
const cloudEmoji = '\u2601\uFE0F';

class WeatherLocationNotFoundError extends Error {
    response = {status: 404};

    constructor(location: string) {
        super(`Location not found: ${location}`);
    }
}

const getApiKey = (): string | null => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    return apiKey && apiKey.trim().length > 0 ? apiKey : null;
};

function getForecastEmoji(main: string): string {
    const normalized = main.toLowerCase();
    if (normalized.includes('rain')) return rainEmoji;
    if (normalized.includes('snow')) return snowEmoji;
    if (normalized.includes('clear')) return clearEmoji;
    if (normalized.includes('cloud')) return cloudEmoji;
    return '';
}

function parseCurrentWeather(data: OpenWeatherCurrentResponse): WeatherData {
    const firstWeather = Array.isArray(data.weather) ? data.weather[0] : undefined;
    if (
        typeof data.name !== 'string'
        || typeof data.sys?.country !== 'string'
        || typeof firstWeather?.description !== 'string'
        || typeof data.main?.temp !== 'number'
        || typeof data.main.feels_like !== 'number'
        || typeof data.main.humidity !== 'number'
        || typeof data.wind?.speed !== 'number'
    ) {
        throw new Error('Malformed weather API response');
    }

    return {
        name: data.name,
        country: data.sys.country,
        description: firstWeather.description,
        temp: data.main.temp,
        feels_like: data.main.feels_like,
        humidity: data.main.humidity,
        wind: data.wind.speed,
    };
}

function parseForecastEntry(entry: OpenWeatherForecastEntry): ForecastEntry {
    const dt = typeof entry.dt === 'number' ? entry.dt : 0;
    const firstWeather = Array.isArray(entry.weather) ? entry.weather[0] : undefined;
    const main = typeof firstWeather?.main === 'string' ? firstWeather.main : 'N/A';
    const description = typeof firstWeather?.description === 'string' ? firstWeather.description : '';
    const temp = typeof entry.main?.temp === 'number' ? entry.main.temp : 0;
    const rainAmount = typeof entry.rain?.['3h'] === 'number' ? entry.rain['3h'] : null;

    const time = new Date(dt * 1000).toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
    });
    const rain = rainAmount ? `${rainEmoji} ${rainAmount}mm` : '';
    const emoji = getForecastEmoji(main);

    return {time, main, description, temp, rain, emoji};
}

function getOpenMeteoWeatherDescription(code: number): { main: string; description: string } {
    if (code === 0) return {main: 'Clear', description: 'clear sky'};
    if (code === 1) return {main: 'Clear', description: 'mainly clear'};
    if (code === 2) return {main: 'Clouds', description: 'partly cloudy'};
    if (code === 3) return {main: 'Clouds', description: 'overcast'};
    if (code === 45 || code === 48) return {main: 'Fog', description: 'fog'};
    if ((code >= 51 && code <= 57)) return {main: 'Rain', description: 'drizzle'};
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return {main: 'Rain', description: 'rain'};
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return {main: 'Snow', description: 'snow'};
    if (code >= 95 && code <= 99) return {main: 'Thunderstorm', description: 'thunderstorm'};
    return {main: 'N/A', description: 'unknown'};
}

function parseOpenMeteoLocation(location: string, data: OpenMeteoGeocodingResponse): OpenMeteoLocation {
    const results = Array.isArray(data.results) ? data.results : [];
    const first = results[0] as OpenMeteoGeocodingResult | undefined;
    if (
        typeof first?.name !== 'string'
        || typeof first.country_code !== 'string'
        || typeof first.latitude !== 'number'
        || typeof first.longitude !== 'number'
    ) {
        throw new WeatherLocationNotFoundError(location);
    }

    return {
        name: first.name,
        country: first.country_code,
        latitude: first.latitude,
        longitude: first.longitude,
    };
}

function parseOpenMeteoCurrent(location: OpenMeteoLocation, data: OpenMeteoForecastResponse): WeatherData {
    const current = data.current;
    if (
        typeof current?.temperature_2m !== 'number'
        || typeof current.apparent_temperature !== 'number'
        || typeof current.relative_humidity_2m !== 'number'
        || typeof current.wind_speed_10m !== 'number'
        || typeof current.weather_code !== 'number'
    ) {
        throw new Error('Malformed weather API response');
    }

    const weather = getOpenMeteoWeatherDescription(current.weather_code);
    return {
        name: location.name,
        country: location.country,
        description: weather.description,
        temp: current.temperature_2m,
        feels_like: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
    };
}

function parseOpenMeteoForecast(data: OpenMeteoForecastResponse, periods: number): ForecastEntry[] {
    const hourly = data.hourly;
    if (
        !Array.isArray(hourly?.time)
        || !Array.isArray(hourly.temperature_2m)
        || !Array.isArray(hourly.precipitation)
        || !Array.isArray(hourly.weather_code)
    ) {
        throw new Error('Malformed weather API response');
    }

    const entries: ForecastEntry[] = [];
    for (let index = 0; index < hourly.time.length && entries.length < periods; index += 1) {
        const timeValue = hourly.time[index];
        const tempValue = hourly.temperature_2m[index];
        const rainValue = hourly.precipitation[index];
        const weatherCode = hourly.weather_code[index];
        if (
            typeof timeValue !== 'string'
            || typeof tempValue !== 'number'
            || typeof rainValue !== 'number'
            || typeof weatherCode !== 'number'
        ) {
            continue;
        }

        const weather = getOpenMeteoWeatherDescription(weatherCode);
        const time = new Date(timeValue).toLocaleString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
        });
        entries.push({
            time,
            main: weather.main,
            description: weather.description,
            temp: tempValue,
            rain: rainValue > 0 ? `${rainEmoji} ${rainValue}mm` : '',
            emoji: getForecastEmoji(weather.main),
        });
    }

    return entries;
}

function getResponseStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return null;
    }

    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null || !('status' in response)) {
        return null;
    }

    const status = (response as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
}

function isAxiosLikeError(error: unknown): boolean {
    return typeof error === 'object'
        && error !== null
        && ('isAxiosError' in error || 'response' in error || 'request' in error);
}

function shouldUseFallback(error: unknown): boolean {
    if (!isAxiosLikeError(error)) return false;
    const status = getResponseStatus(error);
    if (status === 404) return false;
    return status === null || status === 401 || status === 403 || status === 429 || status >= 500;
}

async function resolveOpenMeteoLocation(location: string): Promise<OpenMeteoLocation> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const res = await axios.get<OpenMeteoGeocodingResponse>(url);
    return parseOpenMeteoLocation(location, res.data);
}

async function getOpenMeteoForecastData(location: OpenMeteoLocation): Promise<OpenMeteoForecastResponse> {
    const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
        hourly: 'temperature_2m,precipitation,weather_code',
        forecast_days: '2',
        timezone: 'auto',
    });
    const res = await axios.get<OpenMeteoForecastResponse>(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    return res.data;
}

async function getOpenMeteoCurrentWeather(location: string): Promise<WeatherData> {
    const resolvedLocation = await resolveOpenMeteoLocation(location);
    const data = await getOpenMeteoForecastData(resolvedLocation);
    return parseOpenMeteoCurrent(resolvedLocation, data);
}

async function getOpenMeteoShortTermForecast(location: string, periods: number): Promise<ForecastEntry[]> {
    const resolvedLocation = await resolveOpenMeteoLocation(location);
    const data = await getOpenMeteoForecastData(resolvedLocation);
    return parseOpenMeteoForecast(data, periods);
}

export async function getCurrentWeather(location: string): Promise<WeatherData> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return getOpenMeteoCurrentWeather(location);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    try {
        const res = await axios.get<OpenWeatherCurrentResponse>(url);
        return parseCurrentWeather(res.data);
    } catch (error: unknown) {
        if (!shouldUseFallback(error)) throw error;
        return getOpenMeteoCurrentWeather(location);
    }
}

export async function getShortTermForecast(location: string, periods = 4): Promise<ForecastEntry[]> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return getOpenMeteoShortTermForecast(location, periods);
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    try {
        const res = await axios.get<OpenWeatherForecastResponse>(url);
        if (!Array.isArray(res.data.list)) {
            throw new Error('Malformed weather API response');
        }

        return (res.data.list as OpenWeatherForecastEntry[])
            .slice(0, periods)
            .map(parseForecastEntry);
    } catch (error: unknown) {
        if (!shouldUseFallback(error)) throw error;
        return getOpenMeteoShortTermForecast(location, periods);
    }
}
