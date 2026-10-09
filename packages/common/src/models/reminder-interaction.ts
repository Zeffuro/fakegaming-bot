import { Table, Column, Model, DataType, PrimaryKey, Index } from 'sequelize-typescript';

@Table({ tableName: 'ReminderDrafts' })
export class ReminderDraft extends Model {
    @PrimaryKey
    @Column(DataType.STRING(64))
    declare id: string;

    @Column({ type: DataType.STRING(32), allowNull: false })
    declare userId: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    declare message: string;

    @Index('ix_reminder_draft_expiry')
    @Column({ type: DataType.BIGINT, allowNull: false })
    declare expiresAt: number;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare consumed: boolean;
}

@Table({ tableName: 'ReminderDeliveries' })
export class ReminderDelivery extends Model {
    @PrimaryKey
    @Column(DataType.STRING(64))
    declare id: string;

    @Index({ name: 'ux_reminder_delivery_occurrence', unique: true })
    @Column({ type: DataType.STRING(64), allowNull: false })
    declare reminderId: string;

    @Index({ name: 'ux_reminder_delivery_occurrence', unique: true })
    @Column({ type: DataType.BIGINT, allowNull: false })
    declare scheduledAt: number;

    // Retries move the source time while scheduledAt retains the recurrence anchor.
    @Column({ type: DataType.BIGINT, allowNull: false })
    declare sourceTimestamp: number;

    @Column({ type: DataType.STRING(32), allowNull: false })
    declare userId: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    declare message: string;

    @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
    declare status: 'pending' | 'sending' | 'uncertain' | 'delivered' | 'snoozed' | 'dismissed';

    @Column(DataType.BIGINT)
    declare attemptedAt: number | null;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare finalized: boolean;

    @Column(DataType.STRING(32))
    declare messageId: string | null;

    @Column(DataType.STRING(32))
    declare channelId: string | null;

    @Index('ix_reminder_delivery_expiry')
    @Column({ type: DataType.BIGINT, allowNull: false })
    declare expiresAt: number;
}
