import { seconds, hours } from './helpers/mstime';
const OSUKEY = process.env.OSUKEY;

export function startActions() {
    setInterval(updateScores, hours(12));
};
export default { startActions };

function intervalFrom(callback: () => void, start: Date, interval: number) {
    // Figure out how long to wait
    // If the start date has already passed figure out when the
    // next regular interval should be happening
    const now = new Date(Date.now());
    let init = start.valueOf() - now.valueOf();
    if (init < 0) {
        init %= interval;
        init += interval;
    }
    const timers: {
        timeout: NodeJS.Timeout,
        interval?: NodeJS.Timeout
    } = {
        timeout: setTimeout(() => {
            callback();
            timers.interval = setInterval(callback, interval);
        }, init)
    };
    return timers;
}

function updateScores() {
    // Get players from db
    // Get maps from maplist
    // Get scores for each player for each map
    // If a higher score is found, update the player's db entry
}
