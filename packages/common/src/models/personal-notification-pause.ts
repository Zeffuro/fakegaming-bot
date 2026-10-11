import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'PersonalNotificationPauses' })
export class PersonalNotificationPause extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare enabled: boolean;
    @Column(DataType.BIGINT) declare resumeAt: number | null;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare version: number;
}
