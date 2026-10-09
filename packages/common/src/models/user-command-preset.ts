import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'UserCommandPresets' })
export class UserCommandPreset extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ux_user_command_preset', unique: true })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Index({ name: 'ux_user_command_preset', unique: true })
    @Column({ type: DataType.STRING(40), allowNull: false }) declare name: string;
    @Column({ type: DataType.STRING(100), allowNull: false }) declare commandPath: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare argumentsJson: string;
}
