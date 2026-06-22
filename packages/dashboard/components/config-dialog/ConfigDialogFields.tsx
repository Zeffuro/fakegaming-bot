import React, { useEffect, useMemo, useState } from "react";
import {
    Autocomplete,
    Box,
    Chip,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography
} from "@mui/material";
import { dashboardFieldSx } from "@/components/dashboard/dashboardTheme";

export interface DiscordChannelOption {
    id: string;
    name: string;
}

export type ConfigDialogValue = Record<string, unknown>;

export interface ConfigDialogItemOption {
    label: string;
    value: string;
    description?: string;
    fieldValues?: Record<string, unknown>;
}

interface MessageTemplate {
    tokens: string[];
    helper: string;
    placeholder: string;
    example: string;
}

interface ConfigDialogFieldsProps {
    value: ConfigDialogValue;
    onFieldChange: (field: string, value: unknown) => void;
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder?: string;
    moduleName: string;
    moduleColor: string;
    channels: DiscordChannelOption[];
    loadingChannels: boolean;
    showCustomMessage: boolean;
    showNotificationControls: boolean;
    itemNameOptions?: string[];
    itemNameSearch?: (query: string) => Promise<ConfigDialogItemOption[]>;
}

export function getConfigStringValue(value: ConfigDialogValue, field: string): string {
    const raw = value[field];
    return typeof raw === "string" ? raw : "";
}

function getMessageTemplate(moduleName: string): MessageTemplate {
    if (moduleName === "YouTube") {
        return {
            tokens: ["{title}", "{channel}", "{url}", "{duration}", "{views}"],
            helper: "Tokens: {title}, {channel}, {url}, {duration}, {views}. If {url} is omitted, it will be appended automatically.",
            placeholder: "New video from {channel}: {title} {url}",
            example: "Example: New video from {channel}: {title} {url}"
        };
    }

    if (moduleName === "Bluesky") {
        return {
            tokens: ["{author}", "{handle}", "{text}", "{url}", "{likes}", "{reposts}", "{replies}"],
            helper: "Tokens: {author}, {handle}, {text}, {url}, {likes}, {reposts}, {replies}. If {url} is omitted, it will be appended automatically.",
            placeholder: "New post from {author}: {text} {url}",
            example: "Example: New post from {author}: {text} {url}"
        };
    }

    return {
        tokens: ["{streamer}", "{title}", "{game}", "{url}", "{uptime}", "{viewers}"],
        helper: "Tokens: {streamer}, {title}, {game}, {url}, {uptime}, {viewers}. If {url} is omitted, it will be appended automatically.",
        placeholder: "{streamer} is now live! {url}",
        example: "{streamer} is live: {title} {url}"
    };
}

function appendMessageToken(current: string, token: string): string {
    const separator = current.endsWith(" ") || current.length === 0 ? "" : " ";
    return `${current}${separator}${token}`;
}

function parseOptionalMinutes(value: string): number | null {
    if (value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

export function ConfigDialogFields({
    value,
    onFieldChange,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    moduleName,
    moduleColor,
    channels,
    loadingChannels,
    showCustomMessage,
    showNotificationControls,
    itemNameOptions,
    itemNameSearch
}: ConfigDialogFieldsProps) {
    const fieldSx = dashboardFieldSx(moduleColor);
    const nameValue = getConfigStringValue(value, channelNameField);
    const selectedChannelId = getConfigStringValue(value, "discordChannelId");
    const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
    const customMessage = getConfigStringValue(value, "customMessage");
    const template = getMessageTemplate(moduleName);
    const [searchOptions, setSearchOptions] = useState<ConfigDialogItemOption[]>([]);
    const [searchingItems, setSearchingItems] = useState(false);
    const selectedItemOption = useMemo(() => (
        searchOptions.find((option) => option.value === nameValue) ?? null
    ), [nameValue, searchOptions]);

    useEffect(() => {
        if (!itemNameSearch) return;

        const query = nameValue.trim();
        if (query.length < 2) {
            setSearchOptions([]);
            setSearchingItems(false);
            return;
        }

        let cancelled = false;
        setSearchingItems(true);
        const timer = window.setTimeout(() => {
            itemNameSearch(query)
                .then((options) => {
                    if (!cancelled) setSearchOptions(options);
                })
                .catch(() => {
                    if (!cancelled) setSearchOptions([]);
                })
                .finally(() => {
                    if (!cancelled) setSearchingItems(false);
                });
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [itemNameSearch, nameValue]);

    const applyFieldValues = (fieldValues: Record<string, unknown>) => {
        for (const [field, fieldValue] of Object.entries(fieldValues)) {
            onFieldChange(field, fieldValue);
        }
    };

    return (
        <Box sx={{ pt: 1 }}>
            {itemNameSearch ? (
                <Autocomplete<ConfigDialogItemOption, false, false, true>
                    freeSolo
                    fullWidth
                    options={searchOptions}
                    loading={searchingItems}
                    inputValue={nameValue}
                    value={selectedItemOption}
                    filterOptions={(options) => options}
                    getOptionLabel={(option) => typeof option === "string" ? option : option.label}
                    isOptionEqualToValue={(option, selected) => typeof selected !== "string" && option.value === selected.value}
                    onInputChange={(_event, nextValue, reason) => {
                        if (reason !== "reset") {
                            onFieldChange(channelNameField, nextValue);
                        }
                    }}
                    onChange={(_event, nextValue) => {
                        if (typeof nextValue === "string") {
                            onFieldChange(channelNameField, nextValue);
                            return;
                        }
                        if (!nextValue) return;

                        applyFieldValues({
                            [channelNameField]: nextValue.value,
                            ...(nextValue.fieldValues ?? {}),
                        });
                    }}
                    renderInput={(params) => {
                        const inputSlotProps = params.slotProps.input;
                        return (
                            <TextField
                                {...params}
                                label={channelNameLabel}
                                placeholder={channelNamePlaceholder}
                                sx={[fieldSx, { mb: 2 }]}
                                helperText={`Search ${moduleName} by name, App ID, or URL`}
                                slotProps={{
                                    ...params.slotProps,
                                    input: {
                                        ...inputSlotProps,
                                        endAdornment: (
                                            <>
                                                {searchingItems ? <CircularProgress size={20} /> : null}
                                                {inputSlotProps.endAdornment}
                                            </>
                                        )
                                    }
                                }}
                            />
                        );
                    }}
                    renderOption={(props, option) => (
                        <li
                            {...props}
                            style={{
                                ...props.style,
                                backgroundColor: "rgb(66, 66, 66)",
                                color: "rgb(245, 245, 245)",
                                padding: "8px 16px",
                                display: "block",
                            }}
                        >
                            <Typography component="span" sx={{ display: "block", color: "grey.50", fontWeight: 700 }}>
                                {option.label}
                            </Typography>
                            {option.description && (
                                <Typography component="span" variant="caption" sx={{ display: "block", color: "grey.400" }}>
                                    {option.description}
                                </Typography>
                            )}
                        </li>
                    )}
                    noOptionsText={nameValue.trim().length < 2 ? "Type at least 2 characters" : "No games found"}
                    sx={{
                        "& .MuiAutocomplete-popupIndicator": { color: "grey.400" },
                        "& .MuiAutocomplete-clearIndicator": { color: "grey.400" }
                    }}
                />
            ) : itemNameOptions ? (
                <Autocomplete
                    freeSolo
                    fullWidth
                    options={itemNameOptions}
                    value={nameValue}
                    onInputChange={(_event, nextValue) => onFieldChange(channelNameField, nextValue)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={channelNameLabel}
                            placeholder={channelNamePlaceholder}
                            sx={[fieldSx, { mb: 2 }]}
                        />
                    )}
                />
            ) : (
                <TextField
                    fullWidth
                    label={channelNameLabel}
                    placeholder={channelNamePlaceholder}
                    value={nameValue}
                    onChange={(event) => onFieldChange(channelNameField, event.target.value)}
                    sx={[fieldSx, { mb: 2 }]}
                    helperText={`Enter the ${moduleName} ${channelNameLabel.toLowerCase()}`}
                />
            )}

            <Autocomplete
                fullWidth
                options={channels}
                getOptionLabel={(option) => `#${option.name}`}
                value={selectedChannel}
                onChange={(_event, nextValue) => onFieldChange("discordChannelId", nextValue?.id ?? "")}
                loading={loadingChannels}
                disabled={loadingChannels}
                slots={{
                    paper: ({ children, ...other }) => (
                        <div
                            {...other}
                            style={{
                                backgroundColor: "rgb(66, 66, 66)",
                                border: "1px solid rgb(97, 97, 97)",
                                borderRadius: "4px",
                                ...other.style
                            }}
                        >
                            {children}
                        </div>
                    )
                }}
                renderInput={(params) => {
                    const inputSlotProps = params.slotProps.input;
                    return (
                        <TextField
                            {...params}
                            label="Discord Channel"
                            sx={[fieldSx, { mb: 2 }]}
                            slotProps={{
                                ...params.slotProps,
                                input: {
                                    ...inputSlotProps,
                                    endAdornment: (
                                        <>
                                            {loadingChannels ? <CircularProgress size={20} /> : null}
                                            {inputSlotProps.endAdornment}
                                        </>
                                    )
                                }
                            }}
                        />
                    );
                }}
                renderOption={(props, option) => (
                    <li
                        {...props}
                        style={{
                            ...props.style,
                            backgroundColor: "rgb(66, 66, 66)",
                            color: "rgb(245, 245, 245)",
                            padding: "8px 16px"
                        }}
                    >
                        #{option.name}
                    </li>
                )}
                noOptionsText={loadingChannels ? "Loading channels..." : "No channels available"}
                sx={{
                    "& .MuiAutocomplete-popupIndicator": { color: "grey.400" },
                    "& .MuiAutocomplete-clearIndicator": { color: "grey.400" }
                }}
            />

            {showCustomMessage && (
                <>
                    <TextField
                        fullWidth
                        label="Custom Message (Optional)"
                        placeholder={template.placeholder}
                        value={customMessage}
                        onChange={(event) => onFieldChange("customMessage", event.target.value)}
                        sx={fieldSx}
                        helperText={template.helper}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Typography variant="caption" sx={{ color: "grey.400", mr: 1, alignSelf: "center" }}>
                            Available tokens:
                        </Typography>
                        {template.tokens.map((token) => (
                            <Chip
                                key={token}
                                label={token}
                                size="small"
                                onClick={() => onFieldChange("customMessage", appendMessageToken(customMessage, token))}
                                sx={{ cursor: "pointer" }}
                            />
                        ))}
                    </Stack>
                    <Typography variant="caption" sx={{ color: "grey.500", mt: 1, display: "block" }}>
                        {template.example}
                    </Typography>
                </>
            )}

            {showNotificationControls && (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
                        <TextField
                            label="Cooldown (minutes)"
                            type="number"
                            value={value.cooldownMinutes ?? ""}
                            onChange={(event) => onFieldChange("cooldownMinutes", parseOptionalMinutes(event.target.value))}
                            slotProps={{ htmlInput: { min: 0 } }}
                            sx={fieldSx}
                            helperText="Minimum minutes between notifications (optional)"
                        />
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                            <TextField
                                label="Quiet Start"
                                type="time"
                                value={value.quietHoursStart ?? ""}
                                onChange={(event) => onFieldChange("quietHoursStart", event.target.value)}
                                slotProps={{ htmlInput: { step: 60 } }}
                                sx={fieldSx}
                                helperText="HH:mm (24h)"
                            />
                            <TextField
                                label="Quiet End"
                                type="time"
                                value={value.quietHoursEnd ?? ""}
                                onChange={(event) => onFieldChange("quietHoursEnd", event.target.value)}
                                slotProps={{ htmlInput: { step: 60 } }}
                                sx={fieldSx}
                                helperText="HH:mm (24h)"
                            />
                        </Box>
                    </Box>
                    <FormControlLabel
                        sx={{ mt: 2, color: "grey.200" }}
                        control={(
                            <Switch
                                checked={Boolean(value.paused)}
                                onChange={(event) => onFieldChange("paused", event.target.checked)}
                            />
                        )}
                        label="Paused"
                    />
                </>
            )}
        </Box>
    );
}
