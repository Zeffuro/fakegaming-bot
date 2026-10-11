"use client";
import { Box, Button, Checkbox, FormControlLabel, IconButton, Stack, Typography } from '@mui/material';
import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import type { DashboardSectionId, PersonalDashboardLayout } from '@zeffuro/fakegaming-common/dashboard-layout';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { dashboardAccents, ghostActionButtonSx } from './dashboardTheme';

export function PersonalDashboardCustomize({ layout, disabled, busy, dirty, onMove, onVisibility, onAction }: {
    layout: PersonalDashboardLayout; disabled: boolean; busy: boolean; dirty: boolean;
    onMove: (index: number, offset: number) => void;
    onVisibility: (id: DashboardSectionId, visible: boolean) => void;
    onAction: (action: 'load' | 'save' | 'reset') => void;
}) {
    const { t } = useDashboardI18n();
    const buttonSx = ghostActionButtonSx(dashboardAccents.settings);
    return <Stack spacing={2}>
        <Typography sx={{ color: 'grey.300' }}>{t('dashboardLayout.description')}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {layout.sections.map((section, index) => {
                const name = t(`dashboardLayout.sections.${section.id}`);
                return <Box key={section.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                    minWidth: 0, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, px: 1 }}>
                    <FormControlLabel label={name} sx={{ color: 'grey.100', minWidth: 0, mr: 0, '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere' } }}
                        control={<Checkbox checked={section.visible} disabled={disabled} onChange={(_, visible) => onVisibility(section.id, visible)} />} />
                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                        <IconButton aria-label={t('dashboardLayout.moveUp', { name })} disabled={disabled || index === 0}
                            onClick={() => onMove(index, -1)} sx={{ color: 'grey.100' }}><ArrowUpward fontSize="small" /></IconButton>
                        <IconButton aria-label={t('dashboardLayout.moveDown', { name })} disabled={disabled || index === layout.sections.length - 1}
                            onClick={() => onMove(index, 1)} sx={{ color: 'grey.100' }}><ArrowDownward fontSize="small" /></IconButton>
                    </Stack>
                </Box>;
            })}
        </Box>
        {dirty && <Typography role="status" sx={{ color: 'grey.300' }}>{t('dashboardLayout.unsaved')}</Typography>}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button disabled={disabled || !dirty} onClick={() => onAction('save')} sx={buttonSx}>{t('dashboardLayout.save')}</Button>
            <Button disabled={disabled} onClick={() => onAction('reset')} sx={buttonSx}>{t('dashboardLayout.reset')}</Button>
            <Button disabled={busy} onClick={() => onAction('load')} sx={buttonSx}>{t('dashboardLayout.reload')}</Button>
        </Stack>
    </Stack>;
}
