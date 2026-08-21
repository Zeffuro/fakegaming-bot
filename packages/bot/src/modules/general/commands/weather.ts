import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getGeneralCopy} from '../data/generalCopy.js';
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
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale);
    const location = interaction.options.getString('location', true);
    try {
        const weather = await getCurrentWeather(location);
        const forecast = await getShortTermForecast(location, 4, locale);
        let forecastMsg = `${copy.weather.forecast}\n`;
        for (const entry of forecast) {
            forecastMsg += `${entry.emoji} ${entry.time}: ${capitalize(entry.description)} | ${entry.temp}\u00B0C ${entry.rain}\n`;
        }
        await interaction.reply(
            `${weatherEmoji} ${copy.weather.weatherFor} ${weather.name}, ${weather.country}:\n`
            + `${copy.weather.current}: ${capitalize(weather.description)}\n`
            + `${copy.weather.temperature}: ${weather.temp}\u00B0C (${copy.weather.feelsLike} ${weather.feels_like}\u00B0C)\n`
            + `${copy.weather.humidity}: ${weather.humidity}%\n`
            + `${copy.weather.wind}: ${weather.wind} m/s\n`
            + `\n${forecastMsg}`
        );
    } catch (e: unknown) {
        if (getResponseStatus(e) === 404) {
            await interaction.reply(copy.weather.notFound);
            return;
        }
        if (e instanceof Error && e.message.includes('Weather API key')) {
            await interaction.reply(copy.weather.noKey);
            return;
        }
        await interaction.reply(copy.weather.error);
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
