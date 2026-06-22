import {Table, Column, Model, DataType, Unique, PrimaryKey, AutoIncrement} from 'sequelize-typescript';

@Table
export class SteamNewsSubscriptionConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_guild_steam_app_channel')
    @Column(DataType.INTEGER)
    declare steamAppId: number;

    @Column(DataType.STRING)
    declare appName?: string | null;

    @Unique('unique_guild_steam_app_channel')
    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Unique('unique_guild_steam_app_channel')
    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare lastNewsGid?: string | null;

    @Column(DataType.BIGINT)
    declare lastAnnouncedAt?: number | null;

    @Column(DataType.TEXT)
    declare customMessage?: string | null;

    @Column(DataType.INTEGER)
    declare cooldownMinutes?: number | null;

    @Column(DataType.STRING)
    declare quietHoursStart?: string | null;

    @Column(DataType.STRING)
    declare quietHoursEnd?: string | null;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare paused: boolean;
}
