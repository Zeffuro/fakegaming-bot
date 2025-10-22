import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, Unique } from 'sequelize-typescript';

@Table
export class TikTokStreamConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_guild_tiktok_username')
    @Column(DataType.STRING)
    declare tiktokUsername: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    @Column(DataType.INTEGER)
    declare cooldownMinutes?: number | null;

    @Column(DataType.STRING)
    declare quietHoursStart?: string | null;

    @Column(DataType.STRING)
    declare quietHoursEnd?: string | null;

    @Column(DataType.DATE)
    declare lastNotifiedAt?: Date | null;

    @Unique('unique_guild_tiktok_username')
    @Column(DataType.STRING)
    declare guildId: string;

    @Default(false)
    @Column(DataType.BOOLEAN)
    declare isLive: boolean;
}

