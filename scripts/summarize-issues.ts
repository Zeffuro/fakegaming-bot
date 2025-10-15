/**
 * Summarize issue stubs defined in ISSUES_TODO.md.
 * Parses headings of the form:
 * ### Title (P1) — PENDING
 * and outputs a structured summary grouped by priority and status.
 *
 * Usage: pnpm run issues:summary
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface IssueStub {
    title: string;
    priority: 'P0' | 'P1' | 'P2';
    status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED';
    section: string; // High-level section (e.g., Security / Auth Hardening)
}

interface Summary {
    byPriority: Record<string, { total: number; byStatus: Record<string, number>; titles: string[] }>;
    overall: { total: number; byStatus: Record<string, number> };
}

/** Parse the ISSUES_TODO.md content into issue stubs. */
export function parseIssuesTodo(content: string): IssueStub[] {
    const lines = content.split(/\r?\n/);
    const issues: IssueStub[] = [];
    let currentSection = '';

    // Matches lines like: ### Security: Enforce JWT issuer/audience across API & Dashboard (P0) — PENDING
    const issueRegex = /^###\s+(.+?)\s+\((P[0-2])\)\s+[—-]\s+(PENDING|IN_PROGRESS|DONE|DEFERRED)\s*$/;
    const sectionRegex = /^##\s+(.+)/;

    for (const line of lines) {
        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }
        const issueMatch = line.match(issueRegex);
        if (issueMatch) {
            const [, rawTitle, priority, status] = issueMatch;
            issues.push({
                title: rawTitle.trim(),
                priority: priority as IssueStub['priority'],
                status: status as IssueStub['status'],
                section: currentSection,
            });
        }
    }
    return issues;
}

/** Build a summary grouped by priority and status. */
export function buildSummary(issues: IssueStub[]): Summary {
    const summary: Summary = {
        byPriority: {},
        overall: { total: issues.length, byStatus: {} },
    };

    for (const issue of issues) {
        if (!summary.byPriority[issue.priority]) {
            summary.byPriority[issue.priority] = { total: 0, byStatus: {}, titles: [] };
        }
        const priorityBucket = summary.byPriority[issue.priority];
        priorityBucket.total += 1;
        priorityBucket.byStatus[issue.status] = (priorityBucket.byStatus[issue.status] || 0) + 1;
        priorityBucket.titles.push(`${issue.status === 'DONE' ? '✅' : issue.status === 'IN_PROGRESS' ? '⏳' : '•'} ${issue.title}`);
        summary.overall.byStatus[issue.status] = (summary.overall.byStatus[issue.status] || 0) + 1;
    }

    return summary;
}

/** Format summary for console output. */
export function formatSummary(summary: Summary): string {
    const lines: string[] = [];
    lines.push('Issue Stub Summary');
    lines.push('===================');
    lines.push(`Total: ${summary.overall.total}`);
    const statusOrder: IssueStub['status'][] = ['PENDING', 'IN_PROGRESS', 'DONE', 'DEFERRED'];
    lines.push('Overall Status Counts: ' + statusOrder.map(s => `${s}=${summary.overall.byStatus[s] || 0}`).join(', '));
    lines.push('');
    for (const priority of Object.keys(summary.byPriority).sort()) {
        const bucket = summary.byPriority[priority];
        lines.push(`Priority ${priority}: total=${bucket.total}`);
        lines.push('  Status: ' + statusOrder.map(s => `${s}=${bucket.byStatus[s] || 0}`).join(', '));
        lines.push('  Titles:');
        for (const t of bucket.titles) {
            lines.push(`    ${t}`);
        }
        lines.push('');
    }
    lines.push('Next Focus (P0 PENDING):');
    const nextP0 = summary.byPriority['P0']?.titles.filter(t => t.startsWith('•')) || [];
    for (const t of nextP0) lines.push(`  ${t.substring(2)}`); // remove bullet prefix
    return lines.join('\n');
}

async function main(): Promise<void> {
    try {
        const root = process.cwd();
        const issuesPath = join(root, 'ISSUES_TODO.md');
        const content = await readFile(issuesPath, 'utf8');
        const issues = parseIssuesTodo(content);
        if (issues.length === 0) {
            console.warn('No issue stubs detected. Check formatting of headings in ISSUES_TODO.md.');
            return;
        }
        const summary = buildSummary(issues);
        // eslint-disable-next-line no-console
        console.log(formatSummary(summary));
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to summarize issues:', err);
        process.exitCode = 1;
    }
}

// Always execute (safe; idempotent). Avoid import.meta URL path pitfalls on Windows.
void main();
