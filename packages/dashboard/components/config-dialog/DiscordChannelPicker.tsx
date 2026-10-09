import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { dashboardFieldSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';

interface DiscordChannelPickerProps {
    channels: { id: string; name: string }[];
    value: string;
    onChange: (id: string) => void;
    accent: string;
    loading: boolean;
    disabled?: boolean;
    label?: string;
    placeholder?: string;
}

export function DiscordChannelPicker({ channels, value, onChange, accent, loading, disabled, label, placeholder }: DiscordChannelPickerProps) {
    const { t } = useDashboardI18n();
    return <Autocomplete
        fullWidth
        options={channels}
        getOptionLabel={option => `#${option.name}`}
        getOptionKey={option => option.id}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        value={channels.find(channel => channel.id === value) ?? null}
        onChange={(_event, next) => onChange(next?.id ?? '')}
        loading={loading}
        disabled={disabled || loading}
        slotProps={{
            paper: { sx: { bgcolor: '#111923', backgroundImage: 'none', color: 'grey.100', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2 } },
            listbox: { sx: { maxHeight: 320, '& .MuiAutocomplete-option': { overflowWrap: 'anywhere', '&[aria-selected="true"]': { bgcolor: 'rgba(104,215,255,0.12)' } } } },
        }}
        renderInput={params => <TextField {...params} label={label ?? t('common.discordChannel')} placeholder={placeholder}
            sx={dashboardFieldSx(accent)} slotProps={{ ...params.slotProps, input: { ...params.slotProps.input,
                endAdornment: <>{loading ? <CircularProgress size={20} sx={{ color: accent }} /> : null}{params.slotProps.input.endAdornment}</> } }} />}
        noOptionsText={loading ? t('config.loadingChannels') : t('config.noChannelsAvailable')}
        sx={{ flex: 1, '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { color: 'grey.400' } }}
    />;
}
