export interface paths {
    "/youtube": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all YouTube video configs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of YouTube video configs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["YoutubeVideoConfig"][];
                    };
                };
            };
        };
        /**
         * Upsert a YouTube video config by channel
         * @description Upserts a YouTube config based on channel identity. Allowed body fields:
         *     - youtubeChannelId (string, required)
         *     - discordChannelId (string, required)
         *     - guildId (string, required)
         *     Other fields like cooldownMinutes/quietHours should be updated via PUT /youtube/{id}.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["YoutubeChannelRequest"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        /**
         * Create a new YouTube video config
         * @description Creates a YouTube video configuration for a guild+channel pair.
         *     Allowed fields in request body:
         *     - youtubeChannelId (string, required)
         *     - discordChannelId (string, required)
         *     - guildId (string, required)
         *     - customMessage (string, optional)
         *     - cooldownMinutes (integer >= 0 or null, optional)
         *     - quietHoursStart (HH:mm or null, optional)
         *     - quietHoursEnd (HH:mm or null, optional)
         *     - paused (boolean, optional)
         *
         *     Read-only fields (ignored if provided): lastVideoId, lastNotifiedAt.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["YoutubeCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["YoutubeVideoConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/youtube/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve a YouTube channel identifier (handle/username/UC-Id) to a channelId */
        get: {
            parameters: {
                query: {
                    identifier: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Resolution result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            channelId?: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/youtube/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve public YouTube channel metadata from the channel Atom feed */
        get: {
            parameters: {
                query: {
                    channelId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Public channel metadata when available */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            channelId?: string;
                            title?: string | null;
                            url?: string | null;
                            latestVideoId?: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/youtube/channel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a YouTube video config by channel */
        get: {
            parameters: {
                query: {
                    youtubeChannelId: string;
                    discordChannelId: string;
                    guildId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description YouTube video config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["YoutubeVideoConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        /** Create or update a YouTube video config by channel */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["YoutubeChannelRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                            created?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/youtube/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a YouTube video config by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description YouTube video config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["YoutubeVideoConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        /**
         * Update a YouTube video config by id
         * @description Updates a YouTube configuration by id. Allowed fields in request body:
         *     - youtubeChannelId (string)
         *     - discordChannelId (string)
         *     - guildId (string)
         *     - customMessage (string)
         *     - cooldownMinutes (integer >= 0 or null)
         *     - quietHoursStart (HH:mm or null)
         *     - quietHoursEnd (HH:mm or null)
         *     - paused (boolean)
         *
         *     Read-only fields: lastVideoId, lastNotifiedAt.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["YoutubeUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["YoutubeVideoConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete a YouTube video config by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all users */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of users */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                429: components["responses"]["RateLimitExceeded"];
            };
        };
        put?: never;
        /** Create a new user */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{discordId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a user by Discord ID */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description User config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Update a user by Discord ID */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete a user by Discord ID */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{discordId}/timezone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Set timezone for a user */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserTimezoneUpdateRequest"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{discordId}/defaultReminderTimeSpan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Set default reminder timespan for a user */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserDefaultReminderTimeSpanUpdateRequest"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/userNotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List notes for the authenticated dashboard user */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Personal notes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Create a note for the authenticated dashboard user */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserNoteCreateRequest"];
                };
            };
            responses: {
                /** @description Created note */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/userNotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one note for the authenticated dashboard user */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Personal note */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Update one note for the authenticated dashboard user */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UserNoteUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated note */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete one note for the authenticated dashboard user */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/twitch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all Twitch stream configs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of Twitch stream configs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TwitchStreamConfig"][];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a new Twitch stream config
         * @description Creates or updates a Twitch stream configuration for a guild+streamer pair.
         *     Allowed fields in request body:
         *     - twitchUsername (string, required)
         *     - discordChannelId (string, required)
         *     - guildId (string, required)
         *     - customMessage (string, optional)
         *     - cooldownMinutes (integer >= 0 or null, optional)
         *     - quietHoursStart (HH:mm or null, optional)
         *     - quietHoursEnd (HH:mm or null, optional)
         *     - paused (boolean, optional)
         *
         *     Read-only fields (ignored if provided): isLive, lastNotifiedAt.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TwitchCreateRequest"];
                };
            };
            responses: {
                /** @description Existing config updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/twitch/exists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check if a Twitch stream config exists */
        get: {
            parameters: {
                query: {
                    twitchUsername: string;
                    discordChannelId: string;
                    guildId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Config existence status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exists?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/twitch/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Verify a Twitch username exists */
        get: {
            parameters: {
                query: {
                    username: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Verification result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exists?: boolean;
                            id?: string;
                            login?: string;
                            displayName?: string;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/twitch/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a Twitch stream config by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Twitch stream config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TwitchStreamConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        /**
         * Update a Twitch stream config by id
         * @description Updates a Twitch stream configuration by id. Allowed fields in request body:
         *     - twitchUsername (string)
         *     - discordChannelId (string)
         *     - guildId (string)
         *     - customMessage (string)
         *     - cooldownMinutes (integer >= 0 or null)
         *     - quietHoursStart (HH:mm or null)
         *     - quietHoursEnd (HH:mm or null)
         *     - paused (boolean)
         *
         *     Read-only fields: isLive, lastNotifiedAt.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TwitchUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TwitchStreamConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete a Twitch stream config by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tiktok": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all TikTok stream configs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of TikTok stream configs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TikTokStreamConfig"][];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a new TikTok stream config
         * @description Creates or updates a TikTok stream configuration for a guild+streamer pair.
         *     Allowed fields in request body:
         *     - tiktokUsername (string, required)
         *     - discordChannelId (string, required)
         *     - guildId (string, required)
         *     - customMessage (string, optional)
         *     - cooldownMinutes (integer >= 0 or null, optional)
         *     - quietHoursStart (HH:mm or null, optional)
         *     - quietHoursEnd (HH:mm or null, optional)
         *     - paused (boolean, optional)
         *
         *     Read-only fields (ignored if provided): isLive, lastNotifiedAt.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TikTokCreateRequest"];
                };
            };
            responses: {
                /** @description Existing config updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tiktok/exists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check if a TikTok stream config exists */
        get: {
            parameters: {
                query: {
                    tiktokUsername: string;
                    discordChannelId: string;
                    guildId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Config existence status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exists?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tiktok/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get current live status of a TikTok user */
        get: {
            parameters: {
                query: {
                    username: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Live status information */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            live?: boolean;
                            roomId?: string;
                            title?: string;
                            /** Format: date-time */
                            startedAt?: string;
                            viewers?: number;
                            cover?: string;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tiktok/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a TikTok stream config by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description TikTok stream config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TikTokStreamConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        /**
         * Update a TikTok stream config by id
         * @description Updates a TikTok stream configuration by id. Allowed fields in request body:
         *     - tiktokUsername (string)
         *     - discordChannelId (string)
         *     - guildId (string)
         *     - customMessage (string)
         *     - cooldownMinutes (integer >= 0 or null)
         *     - quietHoursStart (HH:mm or null)
         *     - quietHoursEnd (HH:mm or null)
         *     - paused (boolean)
         *
         *     Read-only fields: isLive, lastNotifiedAt.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TikTokUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TikTokStreamConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete a TikTok stream config by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/steamNewsSubscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Steam news subscriptions */
        get: {
            parameters: {
                query?: {
                    guildId?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of Steam news subscriptions */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /** Upsert a Steam news subscription */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SteamNewsSubscriptionRequest"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        /** Add a Steam news subscription */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SteamNewsSubscriptionRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/steamNewsSubscriptions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a Steam news subscription by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Steam news subscription config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Delete a Steam news subscription by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        /** Pause or resume a Steam news subscription */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PausedStateRequest"];
                };
            };
            responses: {
                /** @description Updated Steam news subscription config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        trace?: never;
    };
    "/steamApps/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search Steam apps by name, App ID, or Steam app URL */
        get: {
            parameters: {
                query: {
                    q: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Ranked Steam app search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/steamApps/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve one Steam app from a name, App ID, or Steam app URL */
        get: {
            parameters: {
                query: {
                    q: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Resolved Steam app */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                /** @description Multiple Steam apps matched the input */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/servers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all servers */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of servers */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Create a new server */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ServerCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/servers/{serverId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a server by ID */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    serverId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Server config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Update a server by ID */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    serverId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ServerUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Delete a server by ID */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    serverId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riotLinks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List linked Riot accounts */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Linked Riot accounts */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riotLinks/{discordId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get linked Riot account by Discord user ID */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Linked Riot account */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        /** Create or update a linked Riot account for a Discord user */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RiotLinkUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated linked Riot account */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                403: components["responses"]["Forbidden"];
                /** @description Riot Account API validation is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /** Remove a linked Riot account for a Discord user */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    discordId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Removed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reminders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all reminders */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of reminders */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReminderConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Add a new reminder */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ReminderCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reminders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a reminder by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Reminder config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReminderConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Remove a reminder by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all quotes */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of quotes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QuoteConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Add a new quote */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["QuoteCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search quotes by text and guildId */
        get: {
            parameters: {
                query: {
                    guildId: string;
                    text: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of quotes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QuoteConfig"][];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes/guild/{guildId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get quotes by guild */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of quotes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QuoteConfig"][];
                    };
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes/guild/{guildId}/author/{authorId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get quotes by author in guild */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    guildId: string;
                    authorId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of quotes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QuoteConfig"][];
                    };
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a quote by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Quote config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Delete a quote by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/patchSubscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all patch subscriptions */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of patch subscriptions */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /** Upsert a patch subscription */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PatchSubscriptionRequest"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        /** Add a new patch subscription */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PatchSubscriptionRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/patchSubscriptions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a patch subscription by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Patch subscription config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Delete a patch subscription by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        /** Pause or resume a patch subscription */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PausedStateRequest"];
                };
            };
            responses: {
                /** @description Updated patch subscription config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        trace?: never;
    };
    "/patchNotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all patch notes */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of patch notes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PatchNoteConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Upsert (add or update) a patch note */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PatchNoteCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/patchNotes/supportedGames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List supported games for patch notes */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description An array of supported game names */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": string[];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/patchNotes/{game}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the latest patch note for a game */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    game: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Patch note config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PatchNoteConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/guild/{guildId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent notification delivery records for a guild */
        get: {
            parameters: {
                query?: {
                    provider?: string;
                    limit?: number;
                    offset?: number;
                };
                header?: never;
                path: {
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Guild-scoped notification delivery records and provider counts */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/admin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent notification delivery records */
        get: {
            parameters: {
                query?: {
                    provider?: string;
                    guildId?: string;
                    limit?: number;
                    offset?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Recent notification delivery records and provider counts */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List allowed jobs and their capabilities */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of jobs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/heartbeat/last": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the last heartbeat payload/time */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Last heartbeat info (or null) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/{name}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get recent runs for a job */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    name: "birthdays" | "heartbeat" | "reminders" | "patchnotes" | "twitch" | "youtube" | "tiktok" | "bluesky" | "anime" | "steamnews";
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Recent runs for the specified job */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/{name}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Manually trigger a job by name */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    name: "birthdays" | "heartbeat" | "reminders" | "patchnotes" | "twitch" | "youtube" | "tiktok" | "bluesky" | "anime" | "steamnews";
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["JobRunRequest"];
                };
            };
            responses: {
                /** @description Job scheduled */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                /** @description Jobs not enabled or queue unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/birthdays/today": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get number of birthday notifications processed today */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Count of processed birthdays for today */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrationHealth/admin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List integration health across guilds */
        get: {
            parameters: {
                query?: {
                    provider?: string;
                    guildId?: string;
                    status?: "unknown" | "healthy" | "warning" | "error" | "paused";
                    limit?: number;
                    offset?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Integration health records and summary counts */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrationHealth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List integration health for a guild */
        get: {
            parameters: {
                query: {
                    guildId: string;
                    provider?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Integration health records for the guild */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/discord/users/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve minimal user profiles and guild nicknames
         * @description Given a guildId and up to 50 user IDs, returns minimal user profiles
         *     with optional cached guild nickname where available. Profiles are cached
         *     in the server-side cache. Any IDs that could not be resolved are listed
         *     under `missed`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DiscordResolveUsersRequest"];
                };
            };
            responses: {
                /** @description Resolved users and list of missed IDs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            users?: components["schemas"]["DiscordMemberMinimal"][];
                            missed?: string[];
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/discord/guilds/{guildId}/members/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search guild members by query (autocomplete) */
        get: {
            parameters: {
                query: {
                    query: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of minimal guild members */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscordMemberMinimal"][];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                429: components["responses"]["RateLimitExceeded"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledModules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List disabled modules (optionally filtered by guild) */
        get: {
            parameters: {
                query?: {
                    guildId?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of disabled modules */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledModuleConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Add a new disabled module */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DisabledModuleCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledModuleConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledModules/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check if a module is disabled in a guild */
        get: {
            parameters: {
                query: {
                    guildId: string;
                    moduleName: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Module disabled status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            disabled?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledModules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a disabled module by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Disabled module config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledModuleConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Delete a disabled module by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledCommands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List disabled commands (optionally filtered by guild) */
        get: {
            parameters: {
                query?: {
                    guildId?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of disabled commands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledCommandConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Add a new disabled command */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DisabledCommandCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledCommandConfig"];
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledCommands/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check if a command is disabled in a guild */
        get: {
            parameters: {
                query: {
                    guildId: string;
                    commandName: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Command disabled status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            disabled?: boolean;
                        };
                    };
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disabledCommands/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a disabled command by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Disabled command config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisabledCommandConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Delete a disabled command by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/guild/{guildId}/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get dashboard summary counts for a guild */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Guild dashboard summary */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bluesky": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all Bluesky post configs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of Bluesky post configs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BlueskyPostConfig"][];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a new Bluesky post config
         * @description Creates or updates a Bluesky post configuration for a guild+handle pair.
         *     Accepts notification controls including customMessage, cooldownMinutes, quietHoursStart, quietHoursEnd, and paused.
         *     Read-only fields: lastPostUri, lastPostCid, lastNotifiedAt.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["BlueskyCreateRequest"];
                };
            };
            responses: {
                /** @description Existing config updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bluesky/exists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check if a Bluesky post config exists */
        get: {
            parameters: {
                query: {
                    blueskyHandle: string;
                    discordChannelId: string;
                    guildId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Config existence status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exists?: boolean;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bluesky/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve public Bluesky profile metadata */
        get: {
            parameters: {
                query: {
                    handle: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Profile resolution result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exists?: boolean;
                            did?: string;
                            handle?: string;
                            displayName?: string;
                            avatar?: string;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bluesky/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a Bluesky post config by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Bluesky post config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BlueskyPostConfig"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Update a Bluesky post config by id */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["BlueskyUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BlueskyPostConfig"];
                    };
                };
            };
        };
        post?: never;
        /** Delete a Bluesky post config by id */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            success?: boolean;
                        };
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/birthdays": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all birthdays */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of birthdays */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BirthdayConfig"][];
                    };
                };
            };
        };
        put?: never;
        /** Add or update a birthday */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["BirthdayCreateRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/birthdays/{userId}/{guildId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a birthday by userId and guildId */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    userId: string;
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Birthday config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Update a birthday by userId and guildId */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["BirthdayUpdateRequest"];
                };
            };
            responses: {
                /** @description Updated birthday config */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        post?: never;
        /** Remove a birthday by userId and guildId */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    userId: string;
                    guildId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login and get a JWT token */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    /**
                     * @example {
                     *       "code": "your_discord_oauth_code"
                     *     }
                     */
                    "application/json": components["schemas"]["AuthLoginRequest"];
                };
            };
            responses: {
                /** @description JWT token and user info */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            token?: string;
                            user?: {
                                id?: string;
                                username?: string;
                                discriminator?: string;
                                avatar?: string;
                            };
                        };
                    };
                };
                /** @description Body validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Invalid Discord OAuth code */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Failed to authenticate with Discord */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditEvents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent admin audit events */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Recent audit events */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/anime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List anime channel subscriptions */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: never;
        };
        put?: never;
        /** Subscribe a guild channel to anime episode notifications */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AnimeSubscribeRequest"];
                };
            };
            responses: {
                /** @description Existing subscription updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Subscription created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/anime/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search AniList media */
        get: {
            parameters: {
                query: {
                    q: string;
                    type?: "anime" | "manga";
                    page?: number;
                    perPage?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Search results with page info */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/anime/season": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List AniList titles for a season */
        get: {
            parameters: {
                query: {
                    season: "current" | "next" | "WINTER" | "SPRING" | "SUMMER" | "FALL";
                    scope?: "airing" | "chart" | "tv" | "all";
                    year?: number;
                    page?: number;
                    perPage?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Seasonal AniList titles with page info */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/anime/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete an anime subscription */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Subscription deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        options?: never;
        head?: never;
        /** Pause or resume an anime subscription */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PausedStateRequest"];
                };
            };
            responses: {
                /** @description Updated anime subscription */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["BadRequest"];
                401: components["responses"]["Unauthorized"];
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        DiscordMemberMinimal: {
            id?: string;
            username?: string;
            global_name?: string | null;
            discriminator?: string | null;
            avatar?: string | null;
            nick?: string | null;
        };
        ErrorResponse: {
            error: {
                /** @example BAD_REQUEST */
                code: string;
                /** @example Body validation failed */
                message: string;
                details?: string[];
            };
        };
        BirthdayConfig: {
            userId: string;
            /** Format: int64 */
            day?: number;
            /** Format: int64 */
            month?: number;
            /** Format: int64 */
            year?: number;
            guildId: string;
            channelId?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        CacheConfig: {
            key: string;
            value: string;
            /** Format: date-time */
            expires: string;
        };
        DisabledCommandConfig: {
            /** Format: int64 */
            id: number;
            guildId?: string;
            commandName?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        DisabledModuleConfig: {
            /** Format: int64 */
            id: number;
            guildId?: string;
            moduleName?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        AnimeSubscriptionConfig: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            anilistId?: number;
            targetType?: string;
            userId?: string;
            guildId?: string;
            channelId?: string;
            /** Format: int64 */
            reminderMinutes?: number;
            /** Format: int64 */
            lastNotifiedEpisode?: number;
            /** Format: int64 */
            lastNotifiedAiringAt?: number;
            paused: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        PatchNoteConfig: {
            /** Format: int64 */
            id: number;
            game?: string;
            title?: string;
            content?: string;
            url?: string;
            /** Format: int64 */
            publishedAt?: number;
            logoUrl?: string;
            imageUrl?: string;
            version?: string;
            /** Format: int64 */
            accentColor?: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        PatchSubscriptionConfig: {
            /** Format: int64 */
            id: number;
            game?: string;
            channelId?: string;
            guildId?: string;
            /** Format: int64 */
            lastAnnouncedAt?: number;
            paused: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        QuoteConfig: {
            id: string;
            guildId?: string;
            quote?: string;
            authorId?: string;
            submitterId?: string;
            /** Format: int64 */
            timestamp?: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ReminderConfig: {
            id: string;
            userId?: string;
            message?: string;
            timespan?: string;
            /** Format: int64 */
            timestamp?: number;
            completed?: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ServerConfig: {
            serverId: string;
            prefix?: string;
            welcomeMessage?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        TwitchStreamConfig: {
            /** Format: int64 */
            id: number;
            twitchUsername?: string;
            discordChannelId?: string;
            customMessage?: string;
            /** Format: int64 */
            cooldownMinutes?: number;
            quietHoursStart?: string;
            quietHoursEnd?: string;
            /** Format: date-time */
            lastNotifiedAt?: string;
            guildId?: string;
            paused?: boolean;
            isLive?: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        TikTokStreamConfig: {
            /** Format: int64 */
            id: number;
            tiktokUsername?: string;
            discordChannelId?: string;
            customMessage?: string;
            /** Format: int64 */
            cooldownMinutes?: number;
            quietHoursStart?: string;
            quietHoursEnd?: string;
            /** Format: date-time */
            lastNotifiedAt?: string;
            guildId?: string;
            paused?: boolean;
            isLive?: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        BlueskyPostConfig: {
            /** Format: int64 */
            id: number;
            blueskyHandle?: string;
            discordChannelId?: string;
            lastPostUri?: string;
            lastPostCid?: string;
            customMessage?: string;
            /** Format: int64 */
            cooldownMinutes?: number;
            quietHoursStart?: string;
            quietHoursEnd?: string;
            /** Format: date-time */
            lastNotifiedAt?: string;
            guildId?: string;
            paused?: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UserConfig: {
            discordId: string;
            nickname?: string;
            timezone?: string;
            defaultReminderTimeSpan?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        YoutubeVideoConfig: {
            /** Format: int64 */
            id: number;
            youtubeChannelId?: string;
            discordChannelId?: string;
            lastVideoId?: string;
            customMessage?: string;
            /** Format: int64 */
            cooldownMinutes?: number;
            quietHoursStart?: string;
            quietHoursEnd?: string;
            /** Format: date-time */
            lastNotifiedAt?: string;
            guildId?: string;
            paused?: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        AnimeSubscribeRequest: {
            anilistId?: number;
            title?: string;
            guildId: string;
            channelId: string;
            reminderMinutes?: number;
        };
        AuthLoginRequest: {
            code: string;
        };
        BirthdayCreateRequest: {
            day: number;
            month: number;
            year?: number;
            userId: string;
            guildId: string;
            channelId: string;
        };
        BirthdayUpdateRequest: {
            day: number;
            month: number;
            year?: number;
            channelId: string;
        };
        BlueskyCreateRequest: {
            blueskyHandle: string;
            discordChannelId: string;
            guildId: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        BlueskyUpdateRequest: {
            blueskyHandle?: string;
            discordChannelId?: string;
            guildId?: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        DisabledCommandCreateRequest: {
            guildId: string;
            commandName: string;
        };
        DisabledModuleCreateRequest: {
            guildId: string;
            moduleName: string;
        };
        DiscordResolveUsersRequest: {
            guildId: string;
            ids: string[];
        };
        JobRunRequest: {
            date?: string;
            force?: boolean;
        };
        PausedStateRequest: {
            paused: boolean;
        };
        PatchNoteCreateRequest: {
            game: string;
            title: string;
            content: string;
            url: string;
            publishedAt: number;
            version: string;
        };
        PatchSubscriptionRequest: {
            game: string;
            channelId: string;
            guildId: string;
            paused?: boolean;
        };
        QuoteCreateRequest: {
            id?: string;
            guildId: string;
            quote: string;
            authorId: string;
            submitterId?: string;
            timestamp: number;
        };
        ReminderCreateRequest: {
            id: string;
            userId: string;
            message: string;
            timespan: string;
            timestamp: number;
            completed?: boolean;
        };
        RiotLinkUpdateRequest: {
            summonerName: string;
            riotIdGameName?: string | null;
            riotIdTagLine?: string | null;
            region: string;
            puuid: string;
        };
        ServerCreateRequest: {
            serverId: string;
            name?: string;
            prefix?: string;
        };
        ServerUpdateRequest: {
            name?: string;
            prefix?: string;
        };
        SteamNewsSubscriptionRequest: {
            steamAppId: number;
            appName?: string;
            discordChannelId: string;
            guildId: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        TikTokCreateRequest: {
            tiktokUsername: string;
            discordChannelId: string;
            guildId: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        TikTokUpdateRequest: {
            tiktokUsername?: string;
            discordChannelId?: string;
            guildId?: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        TwitchCreateRequest: {
            twitchUsername: string;
            discordChannelId: string;
            guildId: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        TwitchUpdateRequest: {
            twitchUsername?: string;
            discordChannelId?: string;
            guildId?: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        UserCreateRequest: {
            discordId: string;
            timezone?: string;
            defaultReminderTimeSpan?: string;
        };
        UserDefaultReminderTimeSpanUpdateRequest: {
            timespan: string;
        };
        UserNoteCreateRequest: {
            title?: string;
            body?: string;
            pinned?: boolean;
        };
        UserNoteUpdateRequest: {
            title?: string;
            body?: string;
            pinned?: boolean;
        };
        UserTimezoneUpdateRequest: {
            timezone: string;
        };
        UserUpdateRequest: {
            timezone?: string;
            defaultReminderTimeSpan?: string;
        };
        YoutubeChannelRequest: {
            youtubeChannelId: string;
            discordChannelId: string;
            guildId: string;
        };
        YoutubeCreateRequest: {
            youtubeChannelId: string;
            discordChannelId: string;
            guildId: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        YoutubeUpdateRequest: {
            youtubeChannelId?: string;
            discordChannelId?: string;
            guildId?: string;
            customMessage?: string;
            cooldownMinutes?: number | null;
            quietHoursStart?: string | null;
            quietHoursEnd?: string | null;
            paused?: boolean;
        };
        RateLimitError: {
            error: {
                /** @example RATE_LIMIT */
                code: string;
                /** @example Rate limit exceeded */
                message: string;
                retryAfterSeconds: number;
            };
        };
    };
    responses: {
        /** @description Validation failed */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Unauthorized */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Forbidden */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Not found */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Conflict */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Rate limit exceeded */
        RateLimitExceeded: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["X-RateLimit-Limit"];
                "X-RateLimit-Remaining": components["headers"]["X-RateLimit-Remaining"];
                "X-RateLimit-Reset": components["headers"]["X-RateLimit-Reset"];
                "Retry-After": components["headers"]["Retry-After"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RateLimitError"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: {
        /** @description Maximum number of requests allowed in the current window */
        "X-RateLimit-Limit": number;
        /** @description Remaining requests in the current window */
        "X-RateLimit-Remaining": number;
        /** @description Unix epoch seconds when the current window resets */
        "X-RateLimit-Reset": number;
        /** @description Seconds to wait before retrying when limited */
        "Retry-After": number;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
