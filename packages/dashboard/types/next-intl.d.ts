import type { englishMessages } from "@/lib/i18n/messages";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

declare module "next-intl" {
    interface AppConfig {
        Locale: DashboardLocale;
        Messages: typeof englishMessages;
    }
}
