import { describe, expect, it } from "vitest";
import { readPublicLegalConfig } from "@/lib/legalConfig";

describe("legalConfig", () => {
    it("uses development defaults when public instance mode is disabled", () => {
        const config = readPublicLegalConfig({});

        expect(config).toMatchObject({
            isPublicInstance: false,
            instanceName: "Fakegaming Bot Dashboard",
            instanceDomain: "localhost:3000",
            operatorName: "Fakegaming Bot operator",
            operatorCountry: null,
            storageCountries: [],
            privacyContact: "Ask your instance operator"
        });
    });

    it("reads public instance values from env", () => {
        const config = readPublicLegalConfig({
            NEXT_PUBLIC_PUBLIC_INSTANCE: "true",
            NEXT_PUBLIC_INSTANCE_NAME: "Fakegaming Bot",
            NEXT_PUBLIC_INSTANCE_DOMAIN: "https://dashboard.example.com/",
            NEXT_PUBLIC_OPERATOR_NAME: "Zeffuro",
            NEXT_PUBLIC_OPERATOR_COUNTRY: "Netherlands",
            NEXT_PUBLIC_STORAGE_COUNTRIES: "Germany, Netherlands",
            NEXT_PUBLIC_PRIVACY_CONTACT: "https://example.com/privacy-contact"
        });

        expect(config).toEqual({
            isPublicInstance: true,
            instanceName: "Fakegaming Bot",
            instanceDomain: "dashboard.example.com",
            operatorName: "Zeffuro",
            operatorCountry: "Netherlands",
            storageCountries: ["Germany", "Netherlands"],
            privacyContact: "https://example.com/privacy-contact"
        });
    });

    it("requires public instance legal fields when public mode is enabled", () => {
        expect(() => readPublicLegalConfig({ NEXT_PUBLIC_PUBLIC_INSTANCE: "1" }))
            .toThrow(/NEXT_PUBLIC_INSTANCE_NAME.*NEXT_PUBLIC_OPERATOR_NAME.*NEXT_PUBLIC_PRIVACY_CONTACT.*NEXT_PUBLIC_INSTANCE_DOMAIN.*NEXT_PUBLIC_STORAGE_COUNTRIES/);
    });
});
