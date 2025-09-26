import {Table, Column, Model, DataType, PrimaryKey, AutoIncrement} from 'sequelize-typescript';

@Table
export class PatchNoteConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare title: string;

    @Column(DataType.TEXT)
    declare content: string;

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