import {Table, Column, Model, DataType} from 'sequelize-typescript';

@Table
export class YoutubeVideoConfig extends Model {
    @Column(DataType.STRING)
    declare youtubeChannelId: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.STRING)
    declare lastVideoId?: string;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    @Column(DataType.STRING)
    declare guildId: string;
}