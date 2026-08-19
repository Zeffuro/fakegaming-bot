import { Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { SupportedOutputLocale } from '../utils/outputLocale.js';

@Table({ tableName: 'GuildLocaleConfigs' })
export class GuildLocaleConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare guildId: string;

    @Default('en')
    @Column({
        type: DataType.STRING,
        validate: { isIn: [['en', 'nl']] },
    })
    declare outputLocale: SupportedOutputLocale;
}
