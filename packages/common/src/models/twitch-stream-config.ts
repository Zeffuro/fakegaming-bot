import {Table, Column, Model, DataType} from 'sequelize-typescript';

@Table
export class TwitchStreamConfig extends Model {
    @Column(DataType.STRING)
    declare twitchUsername: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    @Column(DataType.STRING)
    declare guildId: string;
}