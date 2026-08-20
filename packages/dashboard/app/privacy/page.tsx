import React from "react";
import { PrivacyPageContent } from "@/components/legal/PrivacyPageContent";
import { readPublicLegalConfig } from "@/lib/legalConfig";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
    return <PrivacyPageContent legalConfig={readPublicLegalConfig()} />;
}
