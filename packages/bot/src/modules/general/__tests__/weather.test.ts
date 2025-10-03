import { describe, it, expect, vi, beforeEach, MockedFunction, Mock } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { getCurrentWeather, getShortTermForecast } from '../../../services/weatherService.js';

// Mock the weather service
vi.mock('../../../services/weatherService.js', () => ({
    getCurrentWeather: vi.fn(),
    getShortTermForecast: vi.fn()
}));

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
            { emoji: '☀️', time: '12:00', description: 'clear sky', main: 'Clear', temp: 16.5, rain: '' },
            { emoji: '⛅', time: '15:00', description: 'few clouds', main: 'Clouds', temp: 17.0, rain: '' },
            { emoji: '🌧️', time: '18:00', description: 'light rain', main: 'Rain', temp: 15.2, rain: '0.5mm' },
            { emoji: '🌧️', time: '21:00', description: 'moderate rain', main: 'Rain', temp: 13.8, rain: '2.1mm' }
        ]);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/weather.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Rotterdam,NL')
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the weather services were called with the right location
        expect(getCurrentWeather).toHaveBeenCalledWith('Rotterdam,NL');
        expect(getShortTermForecast).toHaveBeenCalledWith('Rotterdam,NL', 4);

        // Verify the interaction reply contains the expected weather information
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('🌤️ Weather for Rotterdam, NL')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Current: Clear sky')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Temperature: 15.5°C (feels like 14.2°C)')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Short-term forecast:')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('☀️ 12:00: Clear sky | 16.5°C')
        );
    });

    it('handles location not found error gracefully', async () => {
        // Mock the getCurrentWeather to throw a 404 error
        const notFoundError = new Error('Location not found');
        (notFoundError as any).isAxiosError = true;
        (notFoundError as any).response = { status: 404 };
        (getCurrentWeather as Mock).mockRejectedValue(notFoundError);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/weather.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('NonExistentCity')
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the error message
        expect(interaction.reply).toHaveBeenCalledWith(
            'Could not fetch weather data. Please check the location and try again.'
        );
    });

    it('handles missing API key error', async () => {
        // Mock getCurrentWeather to throw a specific API key error
        (getCurrentWeather as Mock).mockRejectedValue(
            new Error('Weather API key not configured or invalid')
        );

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/weather.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Rotterdam,NL')
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the API key error message
        expect(interaction.reply).toHaveBeenCalledWith(
            'Weather API key is not configured.'
        );
    });

    it('handles general errors gracefully', async () => {
        // Mock getCurrentWeather to throw a general error
        (getCurrentWeather as Mock).mockRejectedValue(
            new Error('General service error')
        );

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/weather.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Rotterdam,NL')
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the general error message
        expect(interaction.reply).toHaveBeenCalledWith(
            'An error occurred while fetching weather data.'
        );
    });

    it('handles network errors from Axios', async () => {
        // Mock getCurrentWeather to throw an Axios network error
        const networkError = new Error('Network Error');
        (networkError as any).isAxiosError = true;
        (networkError as any).response = undefined;
        (getCurrentWeather as Mock).mockRejectedValue(networkError);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/weather.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Rotterdam,NL')
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the general error message
        expect(interaction.reply).toHaveBeenCalledWith(
            'An error occurred while fetching weather data.'
        );
    });
});
