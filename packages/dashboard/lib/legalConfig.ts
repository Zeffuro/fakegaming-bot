export interface PublicLegalConfig {
    isPublicInstance: boolean;
    instanceName: string;
    instanceDomain: string;
    operatorName: string;
    operatorCountry: string | null;
    storageCountries: string[];
    privacyContact: string;
}

interface PublicLegalEnv {
    [key: string]: string | undefined;
    NEXT_PUBLIC_PUBLIC_INSTANCE?: string;
    NEXT_PUBLIC_INSTANCE_NAME?: string;
    NEXT_PUBLIC_INSTANCE_DOMAIN?: string;
    NEXT_PUBLIC_OPERATOR_NAME?: string;
    NEXT_PUBLIC_OPERATOR_COUNTRY?: string;
    NEXT_PUBLIC_STORAGE_COUNTRIES?: string;
    NEXT_PUBLIC_PRIVACY_CONTACT?: string;
}

const defaultLegalConfig = {
    instanceName: "Fakegaming Bot Dashboard",
    instanceDomain: "localhost:3000",
    operatorName: "Fakegaming Bot operator",
    operatorCountry: null,
    storageCountries: [] as string[],
    privacyContact: "Ask your instance operator"
} as const;

function cleanOptional(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
}

function readPublicBoolean(value: string | undefined): boolean {
    const normalized = value?.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeDomain(value: string): string {
    return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function parseStorageCountries(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map(country => country.trim())
        .filter(Boolean);
}

function validatePublicInstanceEnv(env: PublicLegalEnv, storageCountries: string[]): void {
    const missing: string[] = [];
    if (!cleanOptional(env.NEXT_PUBLIC_INSTANCE_NAME)) missing.push("NEXT_PUBLIC_INSTANCE_NAME");
    if (!cleanOptional(env.NEXT_PUBLIC_OPERATOR_NAME)) missing.push("NEXT_PUBLIC_OPERATOR_NAME");
    if (!cleanOptional(env.NEXT_PUBLIC_PRIVACY_CONTACT)) missing.push("NEXT_PUBLIC_PRIVACY_CONTACT");
    if (!cleanOptional(env.NEXT_PUBLIC_INSTANCE_DOMAIN)) missing.push("NEXT_PUBLIC_INSTANCE_DOMAIN");
    if (storageCountries.length === 0) missing.push("NEXT_PUBLIC_STORAGE_COUNTRIES");

    if (missing.length > 0) {
        throw new Error(`[legal-config] NEXT_PUBLIC_PUBLIC_INSTANCE=true requires: ${missing.join(", ")}`);
    }
}

export function readPublicLegalConfig(env: PublicLegalEnv = process.env): PublicLegalConfig {
    const isPublicInstance = readPublicBoolean(env.NEXT_PUBLIC_PUBLIC_INSTANCE);
    const storageCountries = parseStorageCountries(env.NEXT_PUBLIC_STORAGE_COUNTRIES);

    if (isPublicInstance) {
        validatePublicInstanceEnv(env, storageCountries);
    }

    return {
        isPublicInstance,
        instanceName: cleanOptional(env.NEXT_PUBLIC_INSTANCE_NAME) ?? defaultLegalConfig.instanceName,
        instanceDomain: normalizeDomain(cleanOptional(env.NEXT_PUBLIC_INSTANCE_DOMAIN) ?? defaultLegalConfig.instanceDomain),
        operatorName: cleanOptional(env.NEXT_PUBLIC_OPERATOR_NAME) ?? defaultLegalConfig.operatorName,
        operatorCountry: cleanOptional(env.NEXT_PUBLIC_OPERATOR_COUNTRY) ?? defaultLegalConfig.operatorCountry,
        storageCountries,
        privacyContact: cleanOptional(env.NEXT_PUBLIC_PRIVACY_CONTACT) ?? defaultLegalConfig.privacyContact
    };
}
