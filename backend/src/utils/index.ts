/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log with timestamp prefix
 */
export function logWithTimestamp(message: string, ...args: any[]): void {
  console.log(`[${getCurrentTimestamp()}] ${message}`, ...args);
}

/**
 * Safely extract a string from unknown data
 */
export function extractString(data: any, field: string, defaultValue: string = ''): string {
  return data?.[field]?.toString() || defaultValue;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}