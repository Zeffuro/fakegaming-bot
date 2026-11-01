"use client";

import RateReview from '@mui/icons-material/RateReview';
import DashboardLayout from '@/components/DashboardLayout';
import { GuildAccessError } from '@/components/GuildAccessError';
import { FeatureHero } from '@/components/dashboard/FeatureHero';
import { FeatureShell } from '@/components/dashboard/FeatureShell';
import { dashboardAccents } from '@/components/dashboard/dashboardTheme';
import { useGuildFromParams } from '@/components/hooks/useGuildFromParams';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { SubmissionsSettings } from '@/components/submissions/SubmissionsSettings';

export default function GuildSubmissionsPage() {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const { t } = useDashboardI18n();
    if (!guild && !guildsLoading) return <GuildAccessError />;
    return <DashboardLayout guild={guild} currentModule="submissions" loading={guildsLoading}>
        <FeatureShell accent={dashboardAccents.commands}>
            <FeatureHero compact icon={<RateReview />} eyebrow={t('submissions.eyebrow')} title={t('submissions.title')}
                description={t('submissions.description')} accent={dashboardAccents.commands} />
            {guild && <SubmissionsSettings key={guildId} guildId={guildId} />}
        </FeatureShell>
    </DashboardLayout>;
}
