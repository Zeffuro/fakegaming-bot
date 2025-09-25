import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getCurrentWeather, getShortTermForecast} from '../../../services/weatherService.js';
import axios from 'axios';

const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather and a short forecast for a specified location')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('City name or city,country (e.g., Rotterdam or Rotterdam,NL)')
            .setRequired(true)
    );

async function execute(interaction: ChatInputCommandInteraction) {
    const location = interaction.options.getString('location', true);
    try {
        const weather = await getCurrentWeather(location);
        const forecast = await getShortTermForecast(location, 4);
        let forecastMsg = 'Short-term forecast:\n';
        for (const entry of forecast) {
            forecastMsg += `${entry.emoji} ${entry.time}: ${entry.description.charAt(0).toUpperCase() + entry.description.slice(1)} | ${entry.temp}°C ${entry.rain}\n`;
        }
        await interaction.reply(
            `🌤️ Weather for ${weather.name}, ${weather.country}:\n` +
            `Current: ${weather.description.charAt(0).toUpperCase() + weather.description.slice(1)}\n` +
            `Temperature: ${weather.temp}°C (feels like ${weather.feels_like}°C)\n` +
            `Humidity: ${weather.humidity}%\n` +
            `Wind: ${weather.wind} m/s\n` +
            `\n${forecastMsg}`
        );
    } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
            if (e.response && e.response.status === 404) {
                await interaction.reply('Could not fetch weather data. Please check the location and try again.');
                return;
            }
        }
        if (e instanceof Error && e.message.includes('Weather API key')) {
            await interaction.reply('Weather API key is not configured.');
            return;
        }
        await interaction.reply('An error occurred while fetching weather data.');
    }
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};