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