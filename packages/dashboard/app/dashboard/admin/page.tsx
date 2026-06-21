"use client";

import React from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminOverview } from "@/components/admin/AdminOverview";

export default function AdminHubPage() {
    return (
        <AdminPage title="Admin panel">
            <AdminOverview />
        </AdminPage>
    );
}
