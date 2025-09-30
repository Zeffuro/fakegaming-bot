import {Table, Column, Model, DataType, Unique} from 'sequelize-typescript';

@Table
export class PatchSubscriptionConfig extends Model {
    @Unique('unique_game_channel_patch_subscription')
    @Column(DataType.STRING)
    declare game: string;

    @Unique('unique_game_channel_patch_subscription')
    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.BIGINT)
    declare lastAnnouncedAt?: number;
}
