export function rethrowActionError(error) {
  const digest=error?.digest;
  if(typeof digest==='string' && (digest.startsWith('NEXT_REDIRECT;') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;'))) throw error;
  // Do not attach the original cause: provider errors can carry query/record details.
  throw new Error('Request could not be completed. Check your input or contact support.');
}
