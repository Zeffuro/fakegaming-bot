import {Router} from 'express';
import authRouter from './auth.js';
import quotesRouter from './quotes.js';
import usersRouter from './users.js';
import serversRouter from './servers.js';
import twitchRouter from './twitch.js';
import youtubeRouter from './youtube.js';
import remindersRouter from './reminders.js';
import birthdaysRouter from './birthdays.js';
import patchNotesRouter from './patchNotes.js';
import patchSubscriptionsRouter from './patchSubscriptions.js';
import disabledCommandsRouter from './disabledCommands.js';

const router = Router();

const routes = [
    { path: '/auth', handler: authRouter },
    { path: '/quotes', handler: quotesRouter },
    { path: '/users', handler: usersRouter },
    { path: '/servers', handler: serversRouter },
    { path: '/twitch', handler: twitchRouter },
    { path: '/youtube', handler: youtubeRouter },
    { path: '/reminders', handler: remindersRouter },
    { path: '/birthdays', handler: birthdaysRouter },
    { path: '/patchNotes', handler: patchNotesRouter },
    { path: '/patchSubscriptions', handler: patchSubscriptionsRouter },
    { path: '/disabledCommands', handler: disabledCommandsRouter },
];

routes.forEach(({ path, handler }) => router.use(path, handler));

export default router;