import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'UserChecklistTemplates' })
export class UserChecklistTemplate extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_checklist_template_owner' })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Column({ type: DataType.STRING(120), allowNull: false }) declare title: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare itemsJson: string;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare version: number;
}
