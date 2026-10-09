import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'UserFollows' })
export class UserFollow extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ux_user_follow', unique: true })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Index({ name: 'ux_user_follow', unique: true })
    @Column({ type: DataType.STRING(16), allowNull: false }) declare provider: 'twitch' | 'steam';
    @Index({ name: 'ux_user_follow', unique: true })
    @Column({ type: DataType.STRING(64), allowNull: false }) declare target: string;
    @Column({ type: DataType.STRING(200), allowNull: false }) declare label: string;
    @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'immediate' }) declare mode: 'immediate' | 'digest';
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare paused: boolean;
    @Column(DataType.STRING(128)) declare cursor: string | null;
}

@Table({ tableName: 'UserFollowSettings' })
export class UserFollowSettings extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column({ type: DataType.STRING(100), allowNull: false, defaultValue: 'UTC' }) declare timezone: string;
    @Column(DataType.STRING(5)) declare quietStart: string | null;
    @Column(DataType.STRING(5)) declare quietEnd: string | null;
    @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '09:00' }) declare digestAt: string;
    @Column(DataType.STRING(10)) declare lastDigestDate: string | null;
}

@Table({ tableName: 'UserFollowEvents' })
export class UserFollowEvent extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Index({ name: 'ux_user_follow_event', unique: true })
    @Column({ type: DataType.STRING(64), allowNull: false }) declare followId: string;
    @Index({ name: 'ux_user_follow_event', unique: true })
    @Column({ type: DataType.STRING(128), allowNull: false }) declare eventKey: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare title: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare url: string;
    @Column({ type: DataType.STRING(16), allowNull: false }) declare mode: 'immediate' | 'digest';
    @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' }) declare status: 'pending' | 'sending' | 'sent' | 'uncertain';
    @Column(DataType.BIGINT) declare attemptedAt: number | null;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare occurredAt: number;
}
