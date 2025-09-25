import {Table, Column, Model, DataType, Unique} from 'sequelize-typescript';

@Unique('unique_game_channel_patch_subscription')
@Table
export class PatchSubscriptionConfig extends Model {
    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.BIGINT)
    declare lastAnnouncedAt?: number;
}