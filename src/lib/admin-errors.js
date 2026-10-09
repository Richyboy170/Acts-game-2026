export function formatSupabaseResetError(error) {
  const code = typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : '';
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : '';

  if (code && message) return `Supabase reset failed (${code}): ${message}`;
  if (message) return `Supabase reset failed: ${message}`;
  return 'Supabase reset failed. Check the Vercel runtime logs for details.';
}
