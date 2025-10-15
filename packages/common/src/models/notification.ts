import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique, Default } from 'sequelize-typescript';

/**
 * Notification record used to deduplicate provider events across restarts.
 * Enforces uniqueness on (provider, eventId).
 */
@Table({ tableName: 'Notifications' })
export class Notification extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_provider_eventId')
    @Column(DataType.STRING)
    declare provider: string; // e.g., 'twitch' | 'youtube'

    @Unique('unique_provider_eventId')
    @Column(DataType.STRING)
    declare eventId: string; // e.g., twitch stream id or youtube video id

    @Column(DataType.STRING)
    declare guildId?: string;

    @Column(DataType.STRING)
    declare channelId?: string;

    @Column(DataType.STRING)
    declare messageId?: string;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare createdAt: Date;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare updatedAt: Date;
}
