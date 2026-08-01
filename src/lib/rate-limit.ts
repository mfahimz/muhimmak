import { getClientIp } from '@/lib/audit/log';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RecordEntry {
  count: number;
  resetTime: number;
}

const stores = new Map<string, Map<string, RecordEntry>>();

export function checkRateLimit(
  request: Request,
  bucketName: string,
  options: RateLimitOptions = { windowMs: 60 * 1000, max: 10 }
): { allowed: boolean; remaining: number; reset: number } {
  const ip = getClientIp(request) || 'unknown_ip';
  const now = Date.now();

  if (!stores.has(bucketName)) {
    stores.set(bucketName, new Map());
  }
  const store = stores.get(bucketName)!;

  // Cleanup expired entries periodically if memory grows
  if (store.size > 5000) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key);
      }
    }
  }

  const record = store.get(ip);
  if (!record || record.resetTime < now) {
    store.set(ip, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return { allowed: true, remaining: options.max - 1, reset: now + options.windowMs };
  }

  if (record.count >= options.max) {
    return { allowed: false, remaining: 0, reset: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: options.max - record.count, reset: record.resetTime };
}
