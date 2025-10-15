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
import { useStreamingForm } from "@/components/hooks/useStreamingForm";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface AddConfigDialogProps<T extends StreamingConfig> {
    open: boolean;
    onClose: () => void;
    onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder: string;
    guildId: string;
    moduleName: string;
    moduleColor: string;
    channels: { id: string; name: string }[];
    loadingChannels: boolean;
    saving: boolean;
    showCustomMessage?: boolean;
    itemSingularLabel?: string;
    itemNameOptions?: string[];
}

export default function AddConfigDialog<T extends StreamingConfig>({
    open,
    onClose,
    onAdd,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    guildId,
    moduleName,
    moduleColor,
    channels,
    loadingChannels,
    saving,
    showCustomMessage = true,
    itemSingularLabel,
    itemNameOptions
}: AddConfigDialogProps<T>) {
    const {
        newConfig,
        setNewConfig,
        handleAddConfig,
        handleChannelNameChange,
        handleChannelAutocompleteChange,
        handleCustomMessageChange
    } = useStreamingForm<T>({
        onAdd,
        onUpdate: async () => false,
        onDelete: async () => false,
        channelNameField,
        guildId
    });

    const selectedChannel = channels.find(ch => ch.id === (newConfig as any).discordChannelId) || null;
    const nameValue = (newConfig as any)[channelNameField] as string;

    const tokens = moduleName === 'Twitch'
        ? ['{streamer}', '{title}', '{game}', '{url}', '{uptime}', '{viewers}']
        : ['{title}', '{channel}', '{url}', '{duration}', '{views}'];

    const insertToken = (token: string) => {
        const current = String((newConfig as any).customMessage ?? '');
        const sep = current.endsWith(' ') || current.length === 0 ? '' : ' ';
        setNewConfig({ ...(newConfig as any), customMessage: `${current}${sep}${token}` });
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
                {itemSingularLabel ? `Add ${itemSingularLabel}` : `Add ${moduleName} ${moduleName === 'YouTube' ? 'Channel' : 'Streamer'}`}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 1 }}>
                    {itemNameOptions ? (
                        <Autocomplete
                            freeSolo
                            fullWidth
                            options={itemNameOptions}
                            value={nameValue || ''}
                            onInputChange={(_e, value) => handleChannelNameChange(value)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={channelNameLabel}
                                    placeholder={channelNamePlaceholder}
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
                            placeholder={channelNamePlaceholder}
                            value={nameValue}
                            onChange={(e) => handleChannelNameChange(e.target.value)}
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
                            handleChannelAutocompleteChange(newValue?.id || '');
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
                                placeholder={moduleName === 'YouTube' ? "New video from {channel}: {title} {url}" : "{streamer} is now live! {url}"}
                                value={(newConfig as any).customMessage}
                                onChange={(e) => handleCustomMessageChange(e.target.value)}
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
                            value={(newConfig as any).cooldownMinutes ?? ''}
                            onChange={(e) => {
                                const v = e.target.value;
                                const parsed = v === '' ? null : Number.isNaN(Number(v)) ? null : Number(v);
                                setNewConfig({ ...(newConfig as any), cooldownMinutes: parsed });
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
                                value={(newConfig as any).quietHoursStart ?? ''}
                                onChange={(e) => setNewConfig({ ...(newConfig as any), quietHoursStart: e.target.value })}
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
                                value={(newConfig as any).quietHoursEnd ?? ''}
                                onChange={(e) => setNewConfig({ ...(newConfig as any), quietHoursEnd: e.target.value })}
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
                    onClick={handleAddConfig}
                    variant="contained"
                    disabled={saving || !nameValue || !(newConfig as any).discordChannelId}
                    sx={{
                        bgcolor: moduleColor,
                        '&:hover': { bgcolor: moduleColor, filter: 'brightness(0.9)' }
                    }}
                >
                    {saving ? <CircularProgress size={20} /> : 'Add'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
