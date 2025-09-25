import {Table, Column, Model, DataType, Unique} from 'sequelize-typescript';

@Table({
    uniqueKeys: {
        unique_game_channel_patch_subscription: {
            fields: ['game', 'channelId']
        }
    }
})
export class PatchSubscriptionConfig extends Model {
    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.BIGINT)
    declare lastAnnouncedAt?: number;
}