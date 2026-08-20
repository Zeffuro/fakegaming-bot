import React from "react";
import { TermsPageContent } from "@/components/legal/TermsPageContent";
import { readPublicLegalConfig } from "@/lib/legalConfig";

export const dynamic = "force-dynamic";

export default function TermsPage() {
    return <TermsPageContent legalConfig={readPublicLegalConfig()} />;
}
