import { UserDashboardLayout } from '../models/user-dashboard-layout.js';
import { UserConfig } from '../models/user-config.js';
import { defaultDashboardSections, mergeDashboardSections, validDashboardLayout, type PersonalDashboardLayout } from '../utils/dashboardLayout.js';
import { PersonalError } from './productivityShared.js';
import { serializedTransaction } from './serializedTransaction.js';

function layout(row: UserDashboardLayout | null): PersonalDashboardLayout {
    if (!row) return { schemaVersion: 1, version: 0, sections: defaultDashboardSections() };
    let sections: unknown;
    try { sections = JSON.parse(row.sectionsJson); } catch { sections = null; }
    return { schemaVersion: 1, version: row.version, sections: mergeDashboardSections(sections) };
}

export class UserDashboardLayoutManager {
    async get(userId: string): Promise<PersonalDashboardLayout> {
        return layout(await UserDashboardLayout.findByPk(userId));
    }
    async save(userId: string, input: PersonalDashboardLayout): Promise<PersonalDashboardLayout> {
        if (!userId || !validDashboardLayout(input)) throw new PersonalError('invalid');
        return serializedTransaction(UserDashboardLayout.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await UserDashboardLayout.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if ((row?.version ?? 0) !== input.version || input.version >= 2147483647) throw new PersonalError('stale');
            const values = { userId, sectionsJson: JSON.stringify(input.sections), schemaVersion: 1, version: input.version + 1 };
            return layout(row ? await row.update(values, { transaction }) : await UserDashboardLayout.create(values, { transaction }));
        });
    }
    async reset(userId: string, version: number): Promise<PersonalDashboardLayout> {
        return this.save(userId, { schemaVersion: 1, version, sections: defaultDashboardSections() });
    }
}
