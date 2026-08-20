import { Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { DEFAULT_OUTPUT_LOCALE, SUPPORTED_OUTPUT_LOCALES, type SupportedOutputLocale } from '../utils/outputLocale.js';

@Table({ tableName: 'GuildLocaleConfigs' })
export class GuildLocaleConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare guildId: string;

    @Default(DEFAULT_OUTPUT_LOCALE)
    @Column({
        type: DataType.STRING,
        validate: { isIn: [SUPPORTED_OUTPUT_LOCALES] },
    })
    declare outputLocale: SupportedOutputLocale;
}
