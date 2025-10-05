import {Table, Column, Model, DataType, PrimaryKey, AutoIncrement} from 'sequelize-typescript';

@Table
export class TwitchStreamConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Column(DataType.STRING)
    declare twitchUsername: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    @Column(DataType.STRING)
    declare guildId: string;
}