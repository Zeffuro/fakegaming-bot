import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { NoteInboxPanel, filterInboxNotes } from '../NoteInboxPanel';
import type { UserNote } from '@/lib/api-client';
import { DashboardI18nProvider } from '@/components/i18n/DashboardI18nProvider';

const notes: UserNote[] = Array.from({ length: 12 }, (_, index) => ({
    id: String(index), discordId: 'owner', title: `Guide ${index}`, body: 'Saved co-op details', pinned: false,
    status: index === 11 ? 'archived' : 'unread', tags: ['games'], sourceUrl: null, createdAt: null, updatedAt: null,
}));

describe('NoteInboxPanel', () => {
    it('filters active, archived, search text and exact tags', () => {
        expect(filterInboxNotes(notes, '', '', 'active')).toHaveLength(11);
        expect(filterInboxNotes(notes, '', '', 'archived')).toHaveLength(1);
        expect(filterInboxNotes(notes, 'GUIDE 10', 'games', 'unread')).toHaveLength(1);
        expect(filterInboxNotes(notes, '', 'game', 'all')).toHaveLength(0);
    });

    it('paginates ten cards and submits owner-bound state changes', async () => {
        const update = vi.fn().mockResolvedValue(notes[0]);
        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);
        try {
            await act(async () => root.render(<DashboardI18nProvider initialLocale="en"><NoteInboxPanel notes={notes} saving={false} onTogglePinned={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onUpdate={update} /></DashboardI18nProvider>));
            expect(container.textContent).not.toContain('Guide 10');
            const markRead = [...container.querySelectorAll('button')].find(button => button.textContent === 'Mark read');
            await act(async () => markRead?.click());
            expect(update).toHaveBeenCalledWith('0', { status: 'read' });
            const next = [...container.querySelectorAll('button')].find(button => button.textContent === 'Next');
            await act(async () => next?.click());
            expect(container.textContent).toContain('Guide 10');
            expect(container.textContent).not.toContain('Guide 0');
        } finally {
            await act(async () => root.unmount());
            container.remove();
        }
    });
});
