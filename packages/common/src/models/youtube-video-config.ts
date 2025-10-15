import {Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique} from 'sequelize-typescript';

@Table
export class YoutubeVideoConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_guild_youtube_channel')
    @Column(DataType.STRING)
    declare youtubeChannelId: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.STRING)
    declare lastVideoId?: string;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    // Per-guild cooldown in minutes; 0 or null disables cooldown
    @Column(DataType.INTEGER)
    declare cooldownMinutes?: number | null;

    // Quiet hours window in HH:mm (24h) local time; if both set, announcements are suppressed during the window
    @Column(DataType.STRING)
    declare quietHoursStart?: string | null;

    @Column(DataType.STRING)
    declare quietHoursEnd?: string | null;

    @Column(DataType.DATE)
    declare lastNotifiedAt?: Date | null;

    @Unique('unique_guild_youtube_channel')
    @Column(DataType.STRING)
    declare guildId: string;
}