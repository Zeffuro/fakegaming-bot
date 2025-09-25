import {jest} from '@jest/globals';
import {
    getCurrentWeatherMock,
    getShortTermForecastMock,
    resetWeatherMocks
} from '../../../test/mocks/mockWeatherService.js';

jest.unstable_mockModule('../../../services/weatherService.js', () => ({
    getCurrentWeather: getCurrentWeatherMock,
    getShortTermForecast: getShortTermForecastMock
}));

import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {CommandInteraction} from 'discord.js';

describe('weather command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetWeatherMocks();
    });

    it('replies with weather and forecast', async () => {
        getCurrentWeatherMock.mockResolvedValue({
            name: 'Rotterdam',
            country: 'NL',
            description: 'clear sky',
            temp: 20,
            feels_like: 19,
            humidity: 50,
            wind: 3,
        });
        getShortTermForecastMock.mockResolvedValue([
            {
                main: 'Clear',
                description: 'clear sky',
                temp: 21,
                emoji: '☀️',
                rain: '',
                time: '12:00',
            }
        ]);
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/weather.js',
            interactionOptions: {stringOptions: {location: 'Rotterdam'}}
        });
        await command.execute(interaction as unknown as CommandInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Weather for Rotterdam, NL:'));
    });

    it('handles not found error', async () => {
        // Simulate an Axios 404 error
        type AxiosErrorLike = Error & { response: { status: number }, isAxiosError: boolean };
        const axiosError = new Error('Request failed with status code 404') as AxiosErrorLike;
        axiosError.response = {status: 404};
        axiosError.isAxiosError = true;
        getCurrentWeatherMock.mockImplementation(() => {
            throw axiosError;
        });
        const {command, interaction} = await setupCommandWithInteraction({
            managerClass: Object,
            managerKey: '',
            commandPath: '../../modules/general/commands/weather.js',
            interactionOptions: {stringOptions: {location: 'Nowhere'}}
        });
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith('Could not fetch weather data. Please check the location and try again.');
    });
});