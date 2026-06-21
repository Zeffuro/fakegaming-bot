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

const rainEmoji = '\uD83C\uDF27\uFE0F';
const snowEmoji = '\u2744\uFE0F';
const clearEmoji = '\u2600\uFE0F';
const cloudEmoji = '\u2601\uFE0F';

const getApiKey = (): string => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error('Weather API key is not configured.');
    return apiKey;
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

export async function getCurrentWeather(location: string): Promise<WeatherData> {
    const apiKey = getApiKey();
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const res = await axios.get<OpenWeatherCurrentResponse>(url);
    return parseCurrentWeather(res.data);
}

export async function getShortTermForecast(location: string, periods = 4): Promise<ForecastEntry[]> {
    const apiKey = getApiKey();
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const res = await axios.get<OpenWeatherForecastResponse>(url);
    if (!Array.isArray(res.data.list)) {
        throw new Error('Malformed weather API response');
    }

    return (res.data.list as OpenWeatherForecastEntry[])
        .slice(0, periods)
        .map(parseForecastEntry);
}
