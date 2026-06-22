import { Table, Column, Model, DataType, PrimaryKey, Index } from 'sequelize-typescript';

@Table
export class UserNoteConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Index('idx_user_notes_discord_updated')
    @Column({ type: DataType.STRING, allowNull: false })
    declare discordId: string;

    @Column({ type: DataType.STRING(160), allowNull: false })
    declare title: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    declare body: string;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare pinned: boolean;
}
