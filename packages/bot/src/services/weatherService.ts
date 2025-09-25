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

interface OpenWeatherForecastEntry {
    dt: number;
    weather: { main: string; description: string }[];
    main: { temp: number };
    rain?: { '3h'?: number };
}

const getApiKey = (): string => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error('Weather API key is not configured.');
    return apiKey;
};

export async function getCurrentWeather(location: string): Promise<WeatherData> {
    const apiKey = getApiKey();
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const res = await axios.get(url);
    const data = res.data;
    // Validate required fields (allow empty string for name/country/description)
    if (!data || typeof data.name === 'undefined' || !data.sys || typeof data.sys.country === 'undefined' || !data.weather || !data.weather[0] || typeof data.weather[0].description === 'undefined' || !data.main || typeof data.main.temp === 'undefined') {
        throw new Error('Malformed weather API response');
    }
    return {
        name: data.name,
        country: data.sys?.country || '',
        description: data.weather?.[0]?.description || 'Unknown',
        temp: data.main?.temp,
        feels_like: data.main?.feels_like,
        humidity: data.main?.humidity,
        wind: data.wind?.speed,
    };
}

export async function getShortTermForecast(location: string, periods = 4): Promise<ForecastEntry[]> {
    const apiKey = getApiKey();
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const res = await axios.get(url);
    const data = res.data;
    const forecastList: OpenWeatherForecastEntry[] = data.list.slice(0, periods);
    return forecastList.map((entry) => {
        const time = new Date(entry.dt * 1000).toLocaleString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short'
        });
        const main = entry.weather?.[0]?.main || 'N/A';
        const desc = entry.weather?.[0]?.description || '';
        const temp = entry.main?.temp;
        const rain = entry.rain?.['3h'] ? `🌧️ ${entry.rain['3h']}mm` : '';
        const emoji = main.toLowerCase().includes('rain') ? '🌧️' : main.toLowerCase().includes('snow') ? '❄️' : main.toLowerCase().includes('clear') ? '☀️' : main.toLowerCase().includes('cloud') ? '☁️' : '';
        return {time, main, description: desc, temp, rain, emoji};
    });
}
