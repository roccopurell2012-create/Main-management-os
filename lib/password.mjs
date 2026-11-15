import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const optionsV1 = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const optionsV2 = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// A non-account hash with the same work factor, used to avoid email-enumeration timing.
export const DUMMY_HASH = 'scrypt-v1:' + '00'.repeat(16) + ':' + '00'.repeat(64);
export const MIN_PASSWORD_LENGTH = 8;
export function passwordInput(value, minimum = 1) {
    if (typeof value !== 'string' || value.length < minimum || value.length > 256)
        throw new Error('Password must contain ' + minimum + ' to 256 characters.');
    return value;
}
export async function passwordHash(password) {
    passwordInput(password, MIN_PASSWORD_LENGTH);
    const salt = randomBytes(16).toString('hex');
    const key = await derive(password, salt, 64, optionsV2);
    return 'scrypt-v2:' + salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, hash) {
    try {
        passwordInput(password);
        const parts = hash.split(':');
        const version = parts[0];
        const current = version === 'scrypt-v1' || version === 'scrypt-v2';
        const [salt, key] = current ? parts.slice(1) : parts;
        if (parts.length !== (current ? 3 : 2) || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key))
            return false;
        const options = version === 'scrypt-v2' ? optionsV2 : version === 'scrypt-v1' ? optionsV1 : { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
        const derived = await derive(password, salt, 64, options);
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
