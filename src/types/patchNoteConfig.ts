export interface PatchNoteConfig {
    game: string;
    title: string;
    content: string;
    url: string;
    publishedAt: number;
    logoUrl?: string;
    imageUrl?: string;
    version?: string;
    accentColor?: number;
}