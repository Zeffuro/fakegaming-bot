import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique, Default } from 'sequelize-typescript';

/**
 * Notification record used to deduplicate provider events across restarts.
 * Enforces uniqueness on (provider, eventId, scopeKey).
 */
@Table({ tableName: 'Notifications' })
export class Notification extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_provider_event_scope')
    @Column(DataType.STRING)
    declare provider: string; // e.g., 'twitch' | 'youtube'

    @Unique('unique_provider_event_scope')
    @Column(DataType.STRING)
    declare eventId: string; // e.g., twitch stream id or youtube video id

    @Unique('unique_provider_event_scope')
    @Default('')
    @Column({ type: DataType.STRING, allowNull: false })
    declare scopeKey: string;

    @Default('sent')
    @Column({ type: DataType.STRING(16), allowNull: false, validate: { isIn: [['sending', 'sent', 'uncertain']] } })
    declare deliveryStatus: 'sending' | 'sent' | 'uncertain';

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
