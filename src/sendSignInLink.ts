/**
 * Sign-in and invitation emails go through Claudia's shared mail component, never through
 * supabase.auth.signInWithOtp.
 *
 * Every Claudia project shares ONE Supabase Auth instance, so they share one email template and
 * one site_url. Calling signInWithOtp therefore sent a generically branded message from the
 * shared template — and, when a project host was not on the redirect allow-list, GoTrue
 * silently fell back to site_url and returned the user to the wrong application entirely. This
 * broke Lintel's sign-in email on 2026-08-11, and the same bug was found independently in
 * S3 Photobook on 2026-08-17 (it had never been migrated when the Lintel fix shipped) — two
 * real, separate incidents from the same root cause, which is exactly why this now lives in one
 * place instead of being hand-copied into a third project.
 *
 * claudia-auth-link mints the link with the Auth admin API and sends it through
 * claudia-send-email, so the branding, the sender and the return host all come from the PROJECT
 * registry (claudia_project_branding) rather than from platform-wide configuration.
 *
 * Note there is no emailRedirectTo here, and that is deliberate: only a RELATIVE path may be
 * supplied. The origin is resolved server-side from the Claudia registry, so a caller cannot
 * name its own host.
 */
export async function sendSignInLink(supabaseUrl: string, project: string, email: string, path = '/'): Promise<void> {
  const res = await fetch(`${supabaseUrl}/functions/v1/claudia-auth-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, email, path }),
  });

  let payload: { ok?: boolean; error?: string } = {};
  try { payload = await res.json(); } catch { /* fall through to the status check */ }

  if (!res.ok || payload.error) {
    throw new Error(payload.error ?? `Could not send the sign-in email (${res.status}).`);
  }
}
