import {Router} from 'express';
import quotesRouter from './quotes.js';
import usersRouter from './users.js';
import serversRouter from './servers.js';
import twitchRouter from './twitch.js';
import youtubeRouter from './youtube.js';
import remindersRouter from './reminders.js';
import birthdaysRouter from './birthdays.js';
import patchNotesRouter from './patchNotes.js';
import patchSubscriptionsRouter from './patchSubscriptions.js';

const router = Router();

router.use('/quotes', quotesRouter);
router.use('/users', usersRouter);
router.use('/servers', serversRouter);
router.use('/twitch', twitchRouter);
router.use('/youtube', youtubeRouter);
router.use('/reminders', remindersRouter);
router.use('/birthdays', birthdaysRouter);
router.use('/patchNotes', patchNotesRouter);
router.use('/patchSubscriptions', patchSubscriptionsRouter);

export default router;