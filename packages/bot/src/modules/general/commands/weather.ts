import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {weather as META} from '../commands.manifest.js';
import {getCurrentWeather, getShortTermForecast} from '../../../services/weatherService.js';

const weatherEmoji = '\uD83C\uDF24\uFE0F';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option.setName('location')
            .setDescription('City name or city,country (e.g., Rotterdam or Rotterdam,NL)')
            .setRequired(true)
    )
);

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
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

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const location = interaction.options.getString('location', true);
    try {
        const weather = await getCurrentWeather(location);
        const forecast = await getShortTermForecast(location, 4);
        let forecastMsg = 'Short-term forecast:\n';
        for (const entry of forecast) {
            forecastMsg += `${entry.emoji} ${entry.time}: ${capitalize(entry.description)} | ${entry.temp}\u00B0C ${entry.rain}\n`;
        }
        await interaction.reply(
            `${weatherEmoji} Weather for ${weather.name}, ${weather.country}:\n`
            + `Current: ${capitalize(weather.description)}\n`
            + `Temperature: ${weather.temp}\u00B0C (feels like ${weather.feels_like}\u00B0C)\n`
            + `Humidity: ${weather.humidity}%\n`
            + `Wind: ${weather.wind} m/s\n`
            + `\n${forecastMsg}`
        );
    } catch (e: unknown) {
        if (getResponseStatus(e) === 404) {
            await interaction.reply('Could not fetch weather data. Please check the location and try again.');
            return;
        }
        if (e instanceof Error && e.message.includes('Weather API key')) {
            await interaction.reply('Weather API key is not configured.');
            return;
        }
        await interaction.reply('An error occurred while fetching weather data.');
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
