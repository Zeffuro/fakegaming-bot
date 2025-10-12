import { describe, it, expect, vi, beforeEach, MockedFunction, Mock } from 'vitest';
import { setupCommandTest, expectReplyText, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { getCurrentWeather, getShortTermForecast } from '../../../services/weatherService.js';

// Mock the weather service
vi.mock('../../../services/weatherService.js', () => ({
    getCurrentWeather: vi.fn(),
    getShortTermForecast: vi.fn()
}));

// Local helper to DRY setup + execute for the weather command
async function setupAndRunWeather(location: string) {
    const { command, interaction } = await setupCommandTest(
        'modules/general/commands/weather.js',
        {
            interaction: {
                stringOptions: { location }
            }
        }
    );

    await command.execute(interaction as unknown as ChatInputCommandInteraction);
    return { interaction };
}

describe('weather command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('displays current weather and forecast when valid location is provided', async () => {
        // Mock the weather service responses
        (getCurrentWeather as MockedFunction<typeof getCurrentWeather>).mockResolvedValue({
            name: 'Rotterdam',
            country: 'NL',
            description: 'clear sky',
            temp: 15.5,
            feels_like: 14.2,
            humidity: 65,
            wind: 3.5
        });

        (getShortTermForecast as MockedFunction<typeof getShortTermForecast>).mockResolvedValue([
            { emoji: '\u2600\ufe0f', time: '12:00', description: 'clear sky', main: 'Clear', temp: 16.5, rain: '' },
            { emoji: '\u26c5', time: '15:00', description: 'few clouds', main: 'Clouds', temp: 17.0, rain: '' },
            { emoji: '\ud83c\udf27\ufe0f', time: '18:00', description: 'light rain', main: 'Rain', temp: 15.2, rain: '0.5mm' },
            { emoji: '\ud83c\udf27\ufe0f', time: '21:00', description: 'moderate rain', main: 'Rain', temp: 13.8, rain: '2.1mm' }
        ]);

        const { interaction } = await setupAndRunWeather('Rotterdam,NL');

        // Verify the weather services were called with the right location
        expect(getCurrentWeather).toHaveBeenCalledWith('Rotterdam,NL');
        expect(getShortTermForecast).toHaveBeenCalledWith('Rotterdam,NL', 4);

        // Verify the interaction reply contains the expected weather information
        expectReplyTextContains(interaction, '\ud83c\udf24\ufe0f Weather for Rotterdam, NL');
        expectReplyTextContains(interaction, 'Current: Clear sky');
        expectReplyTextContains(interaction, 'Temperature: 15.5\u00b0C (feels like 14.2\u00b0C)');
        expectReplyTextContains(interaction, 'Short-term forecast:');
        expectReplyTextContains(interaction, '\u2600\ufe0f 12:00: Clear sky | 16.5\u00b0C');
    });

    it('handles location not found error gracefully', async () => {
        // Mock the getCurrentWeather to throw a 404 error
        const notFoundError = new Error('Location not found');
        (notFoundError as any).isAxiosError = true;
        (notFoundError as any).response = { status: 404 };
        (getCurrentWeather as Mock).mockRejectedValue(notFoundError);

        const { interaction } = await setupAndRunWeather('NonExistentCity');

        // Verify the error message
        expectReplyText(interaction, 'Could not fetch weather data. Please check the location and try again.');
    });

    it('handles missing API key error', async () => {
        // Mock getCurrentWeather to throw a specific API key error
        (getCurrentWeather as Mock).mockRejectedValue(
            new Error('Weather API key not configured or invalid')
        );

        const { interaction } = await setupAndRunWeather('Rotterdam,NL');

        // Verify the API key error message
        expectReplyText(interaction, 'Weather API key is not configured.');
    });

    it('handles general errors gracefully', async () => {
        // Mock getCurrentWeather to throw a general error
        (getCurrentWeather as Mock).mockRejectedValue(
            new Error('General service error')
        );

        const { interaction } = await setupAndRunWeather('Rotterdam,NL');

        // Verify the general error message
        expectReplyText(interaction, 'An error occurred while fetching weather data.');
    });

    it('handles network errors from Axios', async () => {
        // Mock getCurrentWeather to throw an Axios network error
        const networkError = new Error('Network Error');
        (networkError as any).isAxiosError = true;
        (networkError as any).response = undefined;
        (getCurrentWeather as Mock).mockRejectedValue(networkError);

        const { interaction } = await setupAndRunWeather('Rotterdam,NL');

        // Verify the general error message
        expectReplyText(interaction, 'An error occurred while fetching weather data.');
    });
});
