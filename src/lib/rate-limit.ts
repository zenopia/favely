import { headers } from 'next/headers';
import { ApiError } from './api-utils';
import { ErrorType } from './errors';

interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
}

interface RateLimitEntry {
  count: number;
  startTime: number;
  lastCleanup: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

function cleanup() {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now - entry.startTime > entry.lastCleanup + CLEANUP_INTERVAL) {
      rateLimitStore.delete(key);
    }
  });
}

export async function rateLimit(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const windowMs = config.window * 1000;

  // Clean up old entries if needed
  if (Math.random() < 0.1) { // 10% chance to run cleanup on each request
    cleanup();
  }

  const entry = rateLimitStore.get(key) || {
    count: 0,
    startTime: now,
    lastCleanup: now
  };

  // Reset if window has passed
  if (now - entry.startTime > windowMs) {
    entry.count = 0;
    entry.startTime = now;
  }

  // Increment counter
  entry.count++;

  // Update store
  rateLimitStore.set(key, entry);

  // Check if limit is exceeded
  if (entry.count > config.limit) {
    throw new ApiError({
      status: 429,
      message: 'Too many requests',
      type: ErrorType.RATE_LIMIT,
      details: {
        retryAfter: Math.ceil((entry.startTime + windowMs - now) / 1000),
        limit: config.limit,
        current: entry.count
      }
    });
  }

  return {
    current: entry.count,
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    reset: new Date(entry.startTime + windowMs).toISOString()
  };
} 