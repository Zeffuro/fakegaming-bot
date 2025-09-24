import {Table, Column, Model, DataType} from 'sequelize-typescript';

@Table
export class PatchSubscriptionConfig extends Model {
    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.BIGINT)
    declare lastAnnouncedAt?: number;
}