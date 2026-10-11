import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'UserDashboardLayouts' })
export class UserDashboardLayout extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare sectionsJson: string;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) declare schemaVersion: number;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare version: number;
}
