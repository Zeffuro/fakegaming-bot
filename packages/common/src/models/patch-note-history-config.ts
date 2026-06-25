import {Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Index} from 'sequelize-typescript';

@Table
export class PatchNoteHistoryConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Index('patch_note_history_game_url')
    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare title: string;

    @Column(DataType.TEXT)
    declare content: string;

    @Index('patch_note_history_game_content_hash')
    @Column(DataType.STRING)
    declare contentHash?: string;

    @Index('patch_note_history_game_url')
    @Column(DataType.STRING)
    declare url: string;

    @Column(DataType.BIGINT)
    declare publishedAt: number;

    @Column(DataType.STRING)
    declare logoUrl?: string;

    @Column(DataType.STRING)
    declare imageUrl?: string;

    @Column(DataType.STRING)
    declare version?: string;

    @Column(DataType.INTEGER)
    declare accentColor?: number;
}
