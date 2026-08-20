import { useEffect, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { sendSignInLink } from './sendSignInLink';

/**
 * ClaudiaAuthGate — magic-link sign-in gate.
 *
 * Extracted 2026-08-19 from PETGI's and S3 Photobook's real AuthGate.tsx, which were checked
 * and confirmed byte-identical in every line of actual logic (auth state, sendSignInLink call,
 * loading/sent/error handling) — they diverged only in branding (logo/wordmark, strap text,
 * description copy, PETGI's extra footnote paragraph). That convergence itself is real: both
 * files independently hit and fixed the same signInWithOtp branding bug (Lintel 2026-08-11,
 * S3 Photobook 2026-08-17) before this extraction happened, which is exactly the risk of
 * duplicated security-relevant logic this component removes going forward — a third project
 * copying either file today would inherit whichever one it copied, with no guarantee both stay
 * correct as one shared piece.
 *
 * Deliberately not fully dependency-free (unlike ClaudiaTree/ClaudiaCard/ClaudiaCalendar):
 * @supabase/supabase-js is a peer dependency, not avoided. Every real consumer already has it
 * — this component IS an auth integration, and reimplementing Session typing/getSession/
 * onAuthStateChange by hand to avoid one already-present dependency would trade real type
 * safety for no real portability gain.
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
  children: (session: Session) => ReactNode;
}

export default function ClaudiaAuthGate({ project, supabase, supabaseUrl, brandHeader, strap, description, footnote, children }: ClaudiaAuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signIn() {
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

  if (!ready) return <div className="auth"><p className="dim">Loading\u2026</p></div>;
  if (session) return <>{children(session)}</>;

  return (
    <div className="auth">
      <div className="auth-card">
        {brandHeader}
        {strap && <div className="strap" style={{ marginTop: '.35rem' }}>{strap}</div>}
        <h1 style={{ marginTop: '1.4rem', fontSize: '1.45rem' }}>Sign in</h1>
        <p className="dim" style={{ fontSize: '.88rem' }}>{description}</p>
        {sent ? (
          <p style={{ marginTop: '1rem' }}>Check <strong>{email}</strong> for a sign-in link.</p>
        ) : (
          <>
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" className="field" type="email" value={email} autoComplete="email"
                   onChange={(e) => setEmail(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && email) signIn(); }} />
            {error && <p className="err">{error}</p>}
            <button className="btn" disabled={!email || busy} onClick={signIn}>
              {busy ? 'Sending\u2026' : 'Email me a sign-in link'}
            </button>
          </>
        )}
        {footnote && <p className="footnote">{footnote}</p>}
      </div>
    </div>
  );
}
