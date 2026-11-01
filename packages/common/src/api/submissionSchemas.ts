import { z } from 'zod';

const snowflake = z.string().regex(/^\d{1,32}$/);
const categoryFields = {
    name: z.string().trim().min(1).max(80),
    destinationChannelId: snowflake,
    reviewChannelId: snowflake,
    reviewerRoleIds: z.array(snowflake).min(1).max(20),
    submitterRoleIds: z.array(snowflake).max(20),
    enabled: z.boolean(),
};

export const submissionCategoryInputSchema = z.object(categoryFields).strict().refine(
    value => value.destinationChannelId !== value.reviewChannelId,
    { path: ['reviewChannelId'], message: 'invalid_value' },
);
export const submissionCategoryUpdateSchema = z.object({
    ...categoryFields, expectedVersion: z.number().int().nonnegative(),
}).strict().refine(value => value.destinationChannelId !== value.reviewChannelId, {
    path: ['reviewChannelId'], message: 'invalid_value',
});
export const submissionCategoryResponseSchema = z.object({
    ...categoryFields, id: z.string().uuid(), guildId: snowflake, version: z.number().int().nonnegative(),
});
export const submissionOptionsResponseSchema = z.object({
    roles: z.array(z.object({ id: snowflake, name: z.string(), managed: z.boolean() })),
    channels: z.array(z.object({ id: snowflake, name: z.string(), type: z.number().int() })),
});

export type SubmissionCategoryInput = z.infer<typeof submissionCategoryInputSchema>;
export type SubmissionCategoryData = z.infer<typeof submissionCategoryResponseSchema>;
export interface SubmissionAttachment {
    id: string;
    name: string;
    contentType: string;
    size: number;
}
export interface SubmissionContentInput {
    explanation: string;
    link: string | null;
    credit: string | null;
    attachmentCount: number;
}
export type SubmissionStatus = 'uploading' | 'pending' | 'changes_requested' | 'publishing' | 'published'
    | 'rejected' | 'upload_failed' | 'publish_failed' | 'uncertain';
export interface SubmissionRecordData extends SubmissionContentInput {
    id: string;
    guildId: string;
    categoryId: string;
    categoryName: string;
    destinationChannelId: string;
    userId: string;
    status: SubmissionStatus;
    version: number;
    reviewChannelId: string;
    reviewMessageId: string | null;
    attachments: SubmissionAttachment[];
    reviewerId: string | null;
    reason: string | null;
    publishedChannelId: string | null;
    publishedMessageId: string | null;
    createdAt: number;
    updatedAt: number;
}
