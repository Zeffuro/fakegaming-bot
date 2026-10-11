import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'PollTemplates' })
export class PollTemplate extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_poll_template_owner' })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Column({ type: DataType.STRING(120), allowNull: false }) declare title: string;
    @Column({ type: DataType.STRING(200), allowNull: false }) declare question: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare optionsJson: string;
    @Column({ type: DataType.INTEGER, allowNull: false }) declare durationMinutes: number;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare allowMultiple: boolean;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare hideResults: boolean;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare ranked: boolean;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare version: number;
}
