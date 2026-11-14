// Validate record IDs before they reach UUID-typed database queries.
export function isRecordId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
