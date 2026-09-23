const target = 'http://app:3000';
const token = process.env.CRON_INTERNAL_TOKEN;

async function call(path, method, logSuccess = true) {
    const response = await fetch(`${target}${path}`, {
        method,
        headers: { 'x-internal-cron-token': token },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body}`);
    if (logSuccess) {
        console.log(`[scheduler] ${new Date().toISOString()} ${path} ${response.status}`);
    }
}

async function tick() {
    try {
        await call('/api/election-advance', 'POST');
        await call('/api/bill-advance', 'GET');
    } catch (error) {
        console.error('[scheduler]', error);
    } finally {
        setTimeout(tick, 60_000);
    }
}

tick();
