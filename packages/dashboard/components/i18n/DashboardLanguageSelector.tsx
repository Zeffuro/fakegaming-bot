"use client";

import React, { useEffect, useRef, useState } from "react";
import { Alert, FormControl, InputLabel, MenuItem, Select, Snackbar } from "@mui/material";
import { Translate } from "@mui/icons-material";
import { api } from "@/lib/api-client";
import { dashboardLocales, isDashboardLocale } from "@/lib/i18n/localeStore";
import { dashboardLocaleNameKeys } from "@/lib/i18n/messages";
import { useDashboardI18n } from "./DashboardI18nProvider";

export function DashboardLanguageSelector({ syncAccount = true }: { syncAccount?: boolean }) {
    const { locale, setLocale, t } = useDashboardI18n();
    const [saveFailed, setSaveFailed] = useState(false);
    const changedLocally = useRef(false);

    useEffect(() => {
        if (!syncAccount) return;
        let active = true;
        void api.getUserSettings()
            .then(settings => {
                if (active && !changedLocally.current && isDashboardLocale(settings.preferredLocale)) {
                    setLocale(settings.preferredLocale);
                }
            })
            .catch(() => {
                // Public/login surfaces do not have an authenticated preference.
            });
        return () => {
            active = false;
        };
    }, [setLocale, syncAccount]);

    const handleChange = (value: unknown): void => {
        if (!isDashboardLocale(value)) return;
        changedLocally.current = true;
        setLocale(value);
        setSaveFailed(false);
        if (syncAccount) {
            void api.updateUserSettings({ preferredLocale: value }).catch(() => setSaveFailed(true));
        }
    };

    return (
        <>
            <FormControl size="small" sx={{ minWidth: { xs: 52, sm: 148 } }}>
                <InputLabel id="dashboard-language-label" sx={{ display: { xs: "none", sm: "block" } }}>{t("language.label")}</InputLabel>
                <Select
                    labelId="dashboard-language-label"
                    aria-label={t("language.label")}
                    value={locale}
                    label={t("language.label")}
                    onChange={event => handleChange(event.target.value)}
                    startAdornment={<Translate fontSize="small" sx={{ ml: 0.5, mr: { xs: 0, sm: 0.5 } }} />}
                    sx={{ color: "grey.100", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.16)" } }}
                >
                    {dashboardLocales.map(optionLocale => (
                        <MenuItem key={optionLocale} value={optionLocale}>
                            {t(dashboardLocaleNameKeys[optionLocale])}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Snackbar open={saveFailed} autoHideDuration={6000} onClose={() => setSaveFailed(false)}>
                <Alert severity="error" variant="filled" onClose={() => setSaveFailed(false)}>
                    {t("error.serviceUnavailable")}
                </Alert>
            </Snackbar>
        </>
    );
}
