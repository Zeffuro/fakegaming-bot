"use client";
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import type { PersonalSubscriptionOverview } from '@/lib/personalSubscriptionOverview';

export function PersonalOverviewSubscriptions({ overview }: { overview: PersonalSubscriptionOverview }) {
    const { t } = useDashboardI18n();
    const buttonSx = ghostActionButtonSx(dashboardAccents.settings);
    function open(view: 'notifications' | 'account') {
        const url = new URL(window.location.href); url.searchParams.set('view', view);
        window.history.pushState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate'));
    }
    return <FeaturePanel accent={dashboardAccents.settings}>
        <Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
            <Typography variant="h6" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('personal.subscriptionOverviewTitle')}</Typography>
            {overview.items.map(item => <Box key={item.id} sx={{ pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Stack direction="row" sx={{ gap: 1, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ color: 'grey.100', fontWeight: 700 }}>{item.title}</Typography>
                    <Chip size="small" label={item.statusLabel} color={item.status === 'attention' ? 'warning' : item.status === 'active' ? 'success' : 'default'} />
                </Stack>
                {item.status !== 'off' && <Typography variant="body2" sx={{ color: 'grey.400', mt: 0.5, overflowWrap: 'anywhere' }}>{item.detail}</Typography>}
            </Box>)}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button onClick={() => open('notifications')} sx={buttonSx}>{t('dashboardLayout.manageNotifications')}</Button>
                <Button onClick={() => open('account')} sx={buttonSx}>{t('dashboardLayout.manageAccount')}</Button>
            </Stack>
        </Stack>
    </FeaturePanel>;
}
