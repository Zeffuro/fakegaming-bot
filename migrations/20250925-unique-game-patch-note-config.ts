import {Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_game_patch_note ON `PatchNoteConfigs` ("game")');
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.query('DROP INDEX IF EXISTS unique_game_patch_note');
};
