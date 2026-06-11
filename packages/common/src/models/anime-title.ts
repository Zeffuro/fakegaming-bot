import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

@Table
export class AnimeTitle extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique
    @Column(DataType.INTEGER)
    declare anilistId: number;

    @Column(DataType.STRING)
    declare titleRomaji?: string | null;

    @Column(DataType.STRING)
    declare titleEnglish?: string | null;

    @Column(DataType.STRING)
    declare titleNative?: string | null;

    @Column(DataType.TEXT)
    declare description?: string | null;

    @Column(DataType.STRING)
    declare siteUrl?: string | null;

    @Column(DataType.STRING)
    declare coverImageUrl?: string | null;

    @Column(DataType.STRING)
    declare bannerImageUrl?: string | null;

    @Column(DataType.STRING)
    declare format?: string | null;

    @Column(DataType.STRING)
    declare status?: string | null;

    @Column(DataType.STRING)
    declare season?: string | null;

    @Column(DataType.INTEGER)
    declare seasonYear?: number | null;

    @Column(DataType.INTEGER)
    declare episodes?: number | null;

    @Column(DataType.INTEGER)
    declare duration?: number | null;

    @Column(DataType.INTEGER)
    declare averageScore?: number | null;

    @Column(DataType.TEXT)
    declare genresJson?: string | null;

    @Column(DataType.INTEGER)
    declare nextEpisode?: number | null;

    @Column(DataType.BIGINT)
    declare nextAiringAt?: number | null;
}
