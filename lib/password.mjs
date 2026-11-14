import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
// A non-account hash with the same work factor, used to avoid email-enumeration timing.
export const DUMMY_HASH = 'scrypt-v1:' + '00'.repeat(16) + ':' + '00'.repeat(64);
export function passwordInput(value, minimum = 1) {
    if (typeof value !== 'string' || value.length < minimum || value.length > 256)
        throw new Error(`Password must contain ${minimum} to 256 characters.`);
    return value; // Deliberately preserve spaces, including leading/trailing spaces.
}
export async function passwordHash(password) {
    passwordInput(password, 14);
    const salt = randomBytes(16).toString('hex');
    const key = await derive(password, salt, 64, options);
    return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, hash) {
    try {
        passwordInput(password);
        const current = hash.startsWith('scrypt-v1:');
        const parts = hash.split(':');
        const [salt, key] = current ? parts.slice(1) : parts;
        if (parts.length !== (current ? 3 : 2) || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key))
            return false;
        const derived = await derive(password, salt, 64, current ? options : { N: 16384, r: 8, p: 1 });
        return timingSafeEqual(Buffer.from(key, 'hex'), derived);
    }
    catch {
        return false;
    }
}
export function tokenHash(token) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
        throw new Error('Session secret setup required');
    return createHmac('sha256', process.env.SESSION_SECRET).update(token).digest('hex');
}
