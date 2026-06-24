import { Table, Column, Model, DataType, PrimaryKey, Index } from 'sequelize-typescript';

@Table
export class UserDigestSubscriptionConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Index({ name: 'unique_user_digest_subscription_discord', unique: true })
    @Column({ type: DataType.STRING, allowNull: false })
    declare discordId: string;

    @Column({ type: DataType.STRING(16), allowNull: false })
    declare frequency: string;

    @Column({ type: DataType.STRING, allowNull: false })
    declare timezone: string;

    @Column({ type: DataType.STRING(5), allowNull: false })
    declare runAt: string;

    @Column({ type: DataType.INTEGER, allowNull: true })
    declare dayOfWeek?: number | null;

    @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '["reminders"]' })
    declare categories: string;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare paused: boolean;

    @Index('idx_user_digest_subscription_next_run')
    @Column({ type: DataType.BIGINT, allowNull: false })
    declare nextRunAt: number;

    @Column({ type: DataType.BIGINT, allowNull: true })
    declare lastRunAt?: number | null;

    @Column({ type: DataType.BIGINT, allowNull: true })
    declare lastSentAt?: number | null;
}
