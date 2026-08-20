import { useEffect, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { sendSignInLink } from './sendSignInLink';

/**
 * ClaudiaAuthGate — magic-link or password sign-in gate, method chosen by the project.
 *
 * Extracted 2026-08-19 from PETGI's and S3 Photobook's real AuthGate.tsx (magic-link only at
 * the time), extended 2026-08-20 to add password as a real second method — a genuine,
 * already-existing setting found on claudia_project_branding.auth_method (a real column, real
 * CHECK constraint restricting it to 'magic_link' | 'password', all four real projects
 * currently 'magic_link') that no application code was actually reading yet.
 *
 * Two ways to set the method, matching how the setting was actually asked for -- a developer
 * can force it via the authMethod prop (static, needs a redeploy to change), or an admin can
 * set claudia_project_branding.auth_method directly (live, no redeploy) and the component
 * reads it at runtime if the prop is omitted. The prop always wins when given, since a
 * developer explicitly choosing a method in code is a stronger signal than a stored default.
 * Falls back to 'magic_link' -- the current, unchanged behaviour -- if the fetch fails or the
 * column has no row, so every existing consumer's behaviour is untouched unless it opts in.
 *
 * Password mode does NOT add a self-service "forgot password" flow using Supabase's native
 * resetPasswordForEmail -- that would reintroduce the exact bug class this whole component
 * exists to avoid (Supabase's own unbranded template, wrong-host redirect fallback). Instead
 * it reuses sendSignInLink as the recovery path: a user who has not set a password yet, or has
 * forgotten it, can always fall back to the same safe, already-proven magic-link mechanism --
 * no new email-sending code, no new place for that bug class to reappear.
 *
 * These are invite-gated apps with no public self-registration (if you can receive mail at the
 * invited address, you are that member) -- password mode is for signing IN to an account that
 * already exists, not for creating one.
 */
export interface ClaudiaAuthGateProps {
  /** The project's own slug, matching claudia_project_branding.project_slug. */
  project: string;
  supabase: SupabaseClient;
  supabaseUrl: string;
  /** Logo, wordmark, whatever the project's own brand header is — rendered as-is. */
  brandHeader: ReactNode;
  /** Omit if the brandHeader already renders its own strap internally (e.g. PETGI's Logo does). */
  strap?: string;
  description: ReactNode;
  /** Optional small-print below the sign-in form, e.g. PETGI's diagnostic-framework disclaimer. */
  footnote?: ReactNode;
  /**
   * Forces the method regardless of what claudia_project_branding.auth_method says. Omit to
   * let the project's own live setting decide (falls back to 'magic_link' if unset or
   * unreadable) -- this is what makes it admin-configurable rather than developer-only.
   */
  authMethod?: 'magic_link' | 'password';
  children: (session: Session) => ReactNode;
}

export default function ClaudiaAuthGate({ project, supabase, supabaseUrl, brandHeader, strap, description, footnote, authMethod: authMethodProp, children }: ClaudiaAuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authMethod, setAuthMethod] = useState<'magic_link' | 'password'>(authMethodProp ?? 'magic_link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useMagicLinkFallback, setUseMagicLinkFallback] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (authMethodProp) return; // developer forced it -- do not override with a live read
    // Not a direct .from('claudia_project_branding').select() -- that table's RLS only grants
    // SELECT to 'authenticated', and this runs on the login screen itself, before sign-in, as
    // 'anon'. Confirmed directly (a real anonymous REST call returned an empty result) rather
    // than assumed. claudia_project_auth_method() is a narrow, SECURITY DEFINER RPC exposing
    // only this one field to anonymous callers, not the whole branding row.
    supabase.rpc('claudia_project_auth_method', { p_project_slug: project })
      .then(
        ({ data }: { data: string | null }) => {
          if (data === 'password' || data === 'magic_link') setAuthMethod(data);
        },
        () => { /* stays on the safe 'magic_link' default */ },
      );
  }, [project, supabase, authMethodProp]);

  async function signInMagicLink() {
    setBusy(true); setError(null);
    try {
      await sendSignInLink(supabaseUrl, project, email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signInPassword() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (e) setError(e.message);
  }

  const usingMagicLink = authMethod === 'magic_link' || useMagicLinkFallback;

  if (!ready) return <div className="auth"><p className="dim">Loading…</p></div>;
  if (session) return <>{children(session)}</>;

  return (
    <div className="auth">
      <div className="auth-card">
        {brandHeader}
        {strap && <div className="strap" style={{ marginTop: '.35rem' }}>{strap}</div>}
        <h1 style={{ marginTop: '1.4rem', fontSize: '1.45rem' }}>Sign in</h1>
        <p className="dim" style={{ fontSize: '.88rem' }}>{description}</p>

        {usingMagicLink ? (
          sent ? (
            <p style={{ marginTop: '1rem' }}>Check <strong>{email}</strong> for a sign-in link.</p>
          ) : (
            <>
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" className="field" type="email" value={email} autoComplete="email"
                     onChange={(e) => setEmail(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && email) signInMagicLink(); }} />
              {error && <p className="err">{error}</p>}
              <button className="btn" disabled={!email || busy} onClick={signInMagicLink}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
              {authMethod === 'password' && (
                <button type="button" className="btn quiet sm" style={{ marginTop: '.5rem' }}
                        onClick={() => setUseMagicLinkFallback(false)}>
                  Use your password instead
                </button>
              )}
            </>
          )
        ) : (
          <>
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" className="field" type="email" value={email} autoComplete="email"
                   onChange={(e) => setEmail(e.target.value)} />
            <label className="label" htmlFor="password" style={{ marginTop: '.5rem' }}>Password</label>
            <input id="password" className="field" type="password" value={password} autoComplete="current-password"
                   onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && email && password) signInPassword(); }} />
            {error && <p className="err">{error}</p>}
            <button className="btn" disabled={!email || !password || busy} onClick={signInPassword}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="btn quiet sm" style={{ marginTop: '.5rem' }}
                    onClick={() => { setUseMagicLinkFallback(true); setError(null); }}>
              No password set yet, or forgot it? Email me a sign-in link
            </button>
          </>
        )}

        {footnote && <p className="footnote">{footnote}</p>}
      </div>
    </div>
  );
}
