import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    TextField,
    Button,
    CircularProgress,
    Autocomplete,
    Chip,
    Stack,
    Typography
} from "@mui/material";
import { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface EditConfigDialogProps<T extends StreamingConfig> {
    open: boolean;
    onClose: () => void;
    config: T | null;
    onConfigChange: (field: string, value: any) => void;
    onSave: () => Promise<boolean>;
    channelNameField: string;
    channelNameLabel: string;
    moduleName: string;
    moduleColor: string;
    channels: { id: string; name: string }[];
    loadingChannels: boolean;
    saving: boolean;
    itemSingularLabel?: string;
    showCustomMessage?: boolean;
    itemNameOptions?: string[];
}

export default function EditConfigDialog<T extends StreamingConfig>({
    open,
    onClose,
    config,
    onConfigChange,
    onSave,
    channelNameField,
    channelNameLabel,
    moduleName,
    moduleColor,
    channels,
    loadingChannels,
    saving,
    itemSingularLabel,
    showCustomMessage = true,
    itemNameOptions
}: EditConfigDialogProps<T>) {
    if (!config) return null;

    const selectedChannel = channels.find(ch => ch.id === (config as any).discordChannelId) || null;
    const titleLabel = itemSingularLabel ?? (moduleName === 'YouTube' ? 'Channel' : 'Streamer');
    const nameValue = (config as any)[channelNameField] as string;

    const tokens = moduleName === 'Twitch'
        ? ['{streamer}', '{title}', '{game}', '{url}', '{uptime}', '{viewers}']
        : ['{title}', '{channel}', '{url}', '{duration}', '{views}'];

    const insertToken = (token: string) => {
        const current = String((config as any).customMessage ?? '');
        const sep = current.endsWith(' ') || current.length === 0 ? '' : ' ';
        onConfigChange('customMessage', `${current}${sep}${token}`);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: 'grey.800',
                        border: 1,
                        borderColor: 'grey.700'
                    }
                }
            }}
        >
            <DialogTitle sx={{ color: 'grey.100' }}>
                Edit {titleLabel}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 1 }}>
                    {itemNameOptions ? (
                        <Autocomplete
                            freeSolo
                            fullWidth
                            options={itemNameOptions}
                            value={nameValue || ''}
                            onInputChange={(_e, value) => onConfigChange(channelNameField, value)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={channelNameLabel}
                                    sx={{
                                        mb: 2,
                                        '& .MuiInputLabel-root': { color: 'grey.300' },
                                        '& .MuiOutlinedInput-root': {
                                            color: 'grey.100',
                                            '& fieldset': { borderColor: 'grey.600' },
                                            '&:hover fieldset': { borderColor: 'grey.500' },
                                            '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                        }
                                    }}
                                />
                            )}
                        />
                    ) : (
                        <TextField
                            fullWidth
                            label={channelNameLabel}
                            value={nameValue}
                            onChange={(e) => onConfigChange(channelNameField, e.target.value)}
                            sx={{
                                mb: 2,
                                '& .MuiInputLabel-root': { color: 'grey.300' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'grey.100',
                                    '& fieldset': { borderColor: 'grey.600' },
                                    '&:hover fieldset': { borderColor: 'grey.500' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                }
                            }}
                            helperText={`Enter the ${moduleName} ${channelNameLabel.toLowerCase()}`}
                            slotProps={{
                                formHelperText: { sx: { color: 'grey.400' } }
                            }}
                        />
                    )}

                    <Autocomplete
                        fullWidth
                        options={channels}
                        getOptionLabel={(option) => `#${option.name}`}
                        value={selectedChannel}
                        onChange={(_event, newValue) => {
                            onConfigChange('discordChannelId', newValue?.id || '');
                        }}
                        loading={loadingChannels}
                        disabled={loadingChannels}
                        slots={{
                            paper: ({ children, ...other }) => (
                                <div
                                    {...other}
                                    style={{
                                        backgroundColor: 'rgb(66, 66, 66)',
                                        border: '1px solid rgb(97, 97, 97)',
                                        borderRadius: '4px',
                                        ...other.style
                                    }}
                                >
                                    {children}
                                </div>
                            )
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Discord Channel"
                                sx={{
                                    mb: 2,
                                    '& .MuiInputLabel-root': { color: 'grey.300' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'grey.100',
                                        '& fieldset': { borderColor: 'grey.600' },
                                        '&:hover fieldset': { borderColor: 'grey.500' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {loadingChannels ? <CircularProgress size={20} /> : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }
                                }}
                            />
                        )}
                        renderOption={(props, option) => {
                            const { key, ...otherProps } = props as any;
                            return (
                                <li
                                    key={key}
                                    {...otherProps}
                                    style={{
                                        backgroundColor: 'rgb(66, 66, 66)',
                                        color: 'rgb(245, 245, 245)',
                                        padding: '8px 16px',
                                    }}
                                >
                                    #{option.name}
                                </li>
                            );
                        }}
                        noOptionsText={loadingChannels ? "Loading channels..." : "No channels available"}
                        sx={{
                            '& .MuiAutocomplete-popupIndicator': { color: 'grey.400' },
                            '& .MuiAutocomplete-clearIndicator': { color: 'grey.400' }
                        }}
                    />

                    {showCustomMessage && (
                        <>
                            <TextField
                                fullWidth
                                label="Custom Message (Optional)"
                                value={(config as any).customMessage || ''}
                                onChange={(e) => onConfigChange('customMessage', e.target.value)}
                                sx={{
                                    '& .MuiInputLabel-root': { color: 'grey.300' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'grey.100',
                                        '& fieldset': { borderColor: 'grey.600' },
                                        '&:hover fieldset': { borderColor: 'grey.500' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                                helperText={moduleName === 'YouTube'
                                    ? 'Tokens: {title}, {channel}, {url}, {duration}, {views} — If {url} is omitted, it will be appended automatically.'
                                    : 'Tokens: {streamer}, {title}, {game}, {url}, {uptime}, {viewers} — If {url} is omitted, it will be appended automatically.'}
                                slotProps={{
                                    formHelperText: { sx: { color: 'grey.400' } }
                                }}
                            />
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                <Typography variant="caption" sx={{ color: 'grey.400', mr: 1, alignSelf: 'center' }}>
                                    Available tokens:
                                </Typography>
                                {tokens.map((t) => (
                                    <Chip key={t} label={t} size="small" onClick={() => insertToken(t)} sx={{ cursor: 'pointer' }} />
                                ))}
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'grey.500', mt: 1, display: 'block' }}>
                                {moduleName === 'YouTube'
                                    ? 'Example: New video from {channel}: {title} {url}'
                                    : '{streamer} is live: {title} {url}'}
                            </Typography>
                        </>
                    )}

                    {/* Cooldown and Quiet Hours inputs */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                        <TextField
                            label="Cooldown (minutes)"
                            type="number"
                            value={(config as any).cooldownMinutes ?? ''}
                            onChange={(e) => {
                                const v = e.target.value;
                                const parsed = v === '' ? null : Number.isNaN(Number(v)) ? null : Number(v);
                                onConfigChange('cooldownMinutes', parsed);
                            }}
                            slotProps={{ htmlInput: { min: 0 }, formHelperText: { sx: { color: 'grey.400' } } }}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'grey.300' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'grey.100',
                                    '& fieldset': { borderColor: 'grey.600' },
                                    '&:hover fieldset': { borderColor: 'grey.500' },
                                    '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                }
                            }}
                            helperText="Minimum minutes between notifications (optional)"
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label="Quiet Start"
                                type="time"
                                value={(config as any).quietHoursStart ?? ''}
                                onChange={(e) => onConfigChange('quietHoursStart', e.target.value)}
                                slotProps={{ htmlInput: { step: 60 }, formHelperText: { sx: { color: 'grey.400' } } }}
                                sx={{
                                    '& .MuiInputLabel-root': { color: 'grey.300' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'grey.100',
                                        '& fieldset': { borderColor: 'grey.600' },
                                        '&:hover fieldset': { borderColor: 'grey.500' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                                helperText="HH:mm (24h)"
                            />
                            <TextField
                                label="Quiet End"
                                type="time"
                                value={(config as any).quietHoursEnd ?? ''}
                                onChange={(e) => onConfigChange('quietHoursEnd', e.target.value)}
                                slotProps={{ htmlInput: { step: 60 }, formHelperText: { sx: { color: 'grey.400' } } }}
                                sx={{
                                    '& .MuiInputLabel-root': { color: 'grey.300' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'grey.100',
                                        '& fieldset': { borderColor: 'grey.600' },
                                        '&:hover fieldset': { borderColor: 'grey.500' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                                helperText="HH:mm (24h)"
                            />
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={{ color: 'grey.300' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onSave}
                    variant="contained"
                    disabled={saving}
                    sx={{
                        bgcolor: moduleColor,
                        '&:hover': { bgcolor: moduleColor, filter: 'brightness(0.9)' }
                    }}
                >
                    {saving ? <CircularProgress size={20} /> : 'Update'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
