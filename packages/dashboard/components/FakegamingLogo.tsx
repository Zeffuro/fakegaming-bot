"use client";

import BaseAvatar from "./BaseAvatar";
import Image from "next/image";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function FakegamingLogo({
    size = 120,
    variant = "circle",
    elevation = 3,
}: { size?: number; variant?: "circle" | "square"; elevation?: number }) {
    const { t } = useDashboardI18n();

    return (
        <BaseAvatar
            size={size}
            variant={variant}
            elevation={elevation}
            bgcolor="background.paper"
        >
            <Image
                src="/icons/logo.webp"
                alt={t("brand.logoAlt")}
                width={size}
                height={size}
                style={{objectFit: "cover"}}
                priority
            />
        </BaseAvatar>
    );
}
