import { statuses, priorities, categories } from './catalog.mjs';
export function queryFilters(input = {}) {
    const string = k => typeof input[k] === 'string' ? input[k].slice(0, 180) : '';
    const date = k => { const v = string(k); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-01' || v > '9998-12-31')
        return ''; const d = new Date(v + 'T00:00:00Z'); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v ? v : ''; };
    const select = (k, values) => values.includes(string(k)) ? string(k) : '';
    return { q: string('q'), status: select('status', [...statuses, 'active', 'suspended', 'archived']), priority: select('priority', priorities), category: select('category', categories), company: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(string('company')) ? string('company') : '', from: date('from'), to: date('to'), error: select('error', ['rate', 'invalid']) };
}
