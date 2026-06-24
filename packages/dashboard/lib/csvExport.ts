export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = readonly CsvValue[];

export function serializeCsv(headers: readonly string[], rows: readonly CsvRow[]): string {
    const serializedRows = [headers, ...rows].map((row) => row.map(formatCsvCell).join(","));
    return `${serializedRows.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, headers: readonly string[], rows: readonly CsvRow[]): void {
    const csv = serializeCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function createCsvFilename(prefix: string, now = new Date()): string {
    const normalizedPrefix = prefix
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const safePrefix = normalizedPrefix.length > 0 ? normalizedPrefix : "export";
    return `${safePrefix}-${now.toISOString().slice(0, 10)}.csv`;
}

function formatCsvCell(value: CsvValue): string {
    const raw = value === null || value === undefined ? "" : String(value);
    const safe = neutralizeCsvFormula(raw);
    if (/[",\r\n]/.test(safe)) {
        return `"${safe.replace(/"/g, '""')}"`;
    }

    return safe;
}

function neutralizeCsvFormula(value: string): string {
    return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}
