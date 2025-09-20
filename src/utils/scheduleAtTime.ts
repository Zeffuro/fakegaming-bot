/**
 * Schedules a callback to run at a specific hour and minute, then repeats every 24 hours.
 * @param hour The hour (0-23) at which to run the callback.
 * @param minute The minute (0-59) at which to run the callback.
 * @param callback The function to execute at the scheduled time.
 */
export function scheduleAtTime(hour: number, minute: number, callback: () => void) {
    function getNextRunDelay() {
        const now = new Date();
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next.getTime() - now.getTime();
    }

    setTimeout(() => {
        callback();
        setInterval(callback, 24 * 60 * 60 * 1000); // every 24 hours
    }, getNextRunDelay());
}