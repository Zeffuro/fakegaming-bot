import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {BirthdayManager} from '@zeffuro/fakegaming-common/dist/managers/birthdayManager.js';
import {CommandInteraction, GuildTextBasedChannel} from "discord.js";

describe('setBirthday command', () => {
    it('sets a birthday for a user', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: BirthdayManager,
            managerKey: 'birthdayManager',
            commandPath: '../../modules/birthdays/commands/setBirthday.js',
            interactionOptions: {
                stringOptions: {month: "January"},
                integerOptions: {day: 5, year: 1990},
                channelOptions: {channel: {id: "929533532185956352"} as unknown as GuildTextBasedChannel},
                userOptions: {},
            }
        });
        (mockManager.hasBirthday as jest.Mock<Promise<boolean>>).mockResolvedValue(false);
        await command.execute(interaction as unknown as CommandInteraction);

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