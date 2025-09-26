import {Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().addConstraint('PatchNoteConfigs', {
        fields: ['game'],
        type: 'unique',
        name: 'unique_game_patch_note'
    });
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().removeConstraint('PatchNoteConfigs', 'unique_game_patch_note');
};
