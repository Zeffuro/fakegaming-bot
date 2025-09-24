import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {BirthdayManager} from '@zeffuro/fakegaming-common/dist/managers/birthdayManager.js';
import {MockInteraction} from '../../../test/MockInteraction.js';

describe('setBirthday command', () => {
    it('sets a birthday for a user', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/setBirthday.js',
        });

        mockManager.hasBirthday.mockResolvedValue(false);

        const interaction = new MockInteraction({
            stringOptions: {month: "January"},
            integerOptions: {day: 5, year: 1990},
            channelOptions: {channel: {id: "929533532185956352"}},
            userOptions: {},
        });

        await command.execute(interaction as any);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                day: 5,
                month: 1,
                year: 1990,
                channelId: "929533532185956352",
            }),
        );
        expect(interaction.reply).toHaveBeenCalled();
    });
});