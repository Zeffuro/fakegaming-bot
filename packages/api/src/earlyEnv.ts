import { bootstrapEnv } from '@zeffuro/fakegaming-common/core';

// Load package-local .env before any other imports run
bootstrapEnv(import.meta.url);

