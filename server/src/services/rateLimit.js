const inviteFailures = new Map();
const agentIpFailures = new Map();
const agentNameFailures = new Map();

function checkRecord(store, key) {
  const record = store.get(key);
  const now = Date.now();
  if (record?.lockedUntil && now < record.lockedUntil) {
    return {
      blocked: true,
      remaining: Math.ceil((record.lockedUntil - now) / 1000)
    };
  }
  return { blocked: false };
}

function resetExpiredWindow(store, key, windowMs) {
  const record = store.get(key);
  if (record && Date.now() - record.firstFailAt > windowMs) {
    store.delete(key);
  }
}

function recordFailure(store, key, options) {
  const now = Date.now();
  resetExpiredWindow(store, key, options.windowMs);
  const record = store.get(key) || { count: 0, firstFailAt: now };
  record.count += 1;

  if (record.count >= options.hardLimit) {
    record.lockedUntil = now + options.hardLockMs;
    console.warn(`${options.label} hard lock: ${key}, failures=${record.count}`);
  } else if (record.count >= options.softLimit) {
    record.lockedUntil = now + options.softLockMs;
  }

  store.set(key, record);
}

export function checkInviteRateLimit(ip) {
  resetExpiredWindow(inviteFailures, ip, 5 * 60 * 1000);
  return checkRecord(inviteFailures, ip);
}

export function recordInviteFailure(ip) {
  recordFailure(inviteFailures, ip, {
    label: 'Invite',
    windowMs: 5 * 60 * 1000,
    softLimit: 5,
    hardLimit: 10,
    softLockMs: 15 * 60 * 1000,
    hardLockMs: 2 * 60 * 60 * 1000
  });
}

export function clearInviteFailure(ip) {
  inviteFailures.delete(ip);
}

export function checkAgentRateLimit(ip, username) {
  resetExpiredWindow(agentIpFailures, ip, 10 * 60 * 1000);
  resetExpiredWindow(agentNameFailures, username, 10 * 60 * 1000);

  const ipLimit = checkRecord(agentIpFailures, ip);
  if (ipLimit.blocked) return ipLimit;

  return checkRecord(agentNameFailures, username);
}

export function recordAgentFailure(ip, username) {
  recordFailure(agentIpFailures, ip, {
    label: 'Agent IP',
    windowMs: 10 * 60 * 1000,
    softLimit: 10,
    hardLimit: 20,
    softLockMs: 60 * 60 * 1000,
    hardLockMs: 60 * 60 * 1000
  });

  recordFailure(agentNameFailures, username, {
    label: 'Agent username',
    windowMs: 10 * 60 * 1000,
    softLimit: 5,
    hardLimit: 15,
    softLockMs: 30 * 60 * 1000,
    hardLockMs: 24 * 60 * 60 * 1000
  });
}

export function clearAgentFailure(ip, username) {
  agentIpFailures.delete(ip);
  agentNameFailures.delete(username);
}
