import {Table, Column, Model, DataType, PrimaryKey, Default, Unique, AllowNull} from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';

export type TwitchClipPermission = 'everyone' | 'subscribers' | 'moderators' | 'owner';

@Table
export class TwitchClipConfig extends Model {
    @PrimaryKey
    @Default(() => randomUUID())
    @Column(DataType.STRING)
    declare id: string;

    @AllowNull(false)
    @Unique('unique_guild_twitch_clip_username')
    @Column(DataType.STRING)
    declare guildId: string;

    @AllowNull(false)
    @Unique('unique_guild_twitch_clip_username')
    @Column(DataType.STRING)
    declare twitchUsername: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare broadcasterId: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Default('!clip')
    @AllowNull(false)
    @Column(DataType.STRING)
    declare command: string;

    @Default([])
    @AllowNull(false)
    @Column(DataType.JSON)
    declare aliases: string[];

    @Default('everyone')
    @AllowNull(false)
    @Column(DataType.STRING)
    declare permission: TwitchClipPermission;

    @Default(30)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare cooldownSeconds: number;

    @Default(30)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare durationSeconds: number;

    @Default(true)
    @AllowNull(false)
    @Column(DataType.BOOLEAN)
    declare enabled: boolean;

    @Default(true)
    @AllowNull(false)
    @Column(DataType.BOOLEAN)
    declare replyEnabled: boolean;

    @Column(DataType.TEXT)
    declare replyTemplate: string | null;
}
