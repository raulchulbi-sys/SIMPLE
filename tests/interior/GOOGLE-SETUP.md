# Google sign-in — release validation

Base: published main `7b5e59cb4264ef579f8044add8a17e548714eb8d`.
The isolated `codex/google-auth` branch incorporates that complete tree.

## Configuration

Google Cloud project SIMPLE (`simple-509717`) uses the existing SIMPLE Web
application client. Authorized JavaScript origin:
`https://raulchulbi-sys.github.io`.
Authorized callback:
`https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback`.

Only basic identity, email and profile scopes are configured. Audience remains
External / Testing, as authorized. Google's documented exception for basic
Sign in with Google permits access without adding test users or imposing the
seven-day testing authorization expiry. Workspace administrator restrictions
can still apply. Branding is not verified: the consent screen currently shows
the Supabase project hostname. No invented privacy/terms URLs or billing changes.

The owner explicitly authorized transferring the existing Client ID/Secret
between the Google and Supabase panels and enabling only Google. Credentials
are stored in Supabase, never in frontend source or test evidence. Skip nonce
checks and Allow users without an email remain disabled. No SMTP, Site URL,
Redirect URLs, other provider, permission, role or training-data configuration
changes were made.

## Product change

`assets/oauth.js` releases Google only. The existing implementation still
requires both the release flag and Google enabled in Supabase settings. If
settings fail or Google is disabled, its button remains hidden. Apple and
Facebook remain false. The only `assets/auth.js` edit removes an outdated
configuration comment; email, recovery and callback/profile code are unchanged.
The OAuth script URL is versioned so a previously open tab fetches the released
Google gate on reload instead of reusing the pre-release script from cache.

## Real account validation

Authorized live sign-in from the private current-SIMPLE preview returned to
`https://raulchulbi-sys.github.io/SIMPLE/` and opened the trainer dashboard.
Read-only SQL before/after confirmed the same user UUID, unchanged profile hash
and role, one account for the email, and email plus Google identities. Account
linking was handled by Supabase; no manual linking, profile update or deletion.

Reload and a new public navigation preserved the session. Logout returned to
welcome. Entering through Create account with Athlete selected still reopened
the existing Trainer profile. No duplicate account/profile was created.

The existing email athlete was subsequently verified through real Google login:
same UUID, client profile and role, automatic Supabase linking, unchanged routine,
assignment, workout and note fingerprints, reload, logout and second sign-in.

On 27 September the authorized new temporary Google athlete also completed real
registration. Before OAuth the email had no Auth user. On return, the existing
Complete registration screen asked for the role; choosing Athlete created one
client profile with the Auth UUID. Reload, logout and a second Google sign-in
preserved that UUID and sole profile. No routines, assignments, workouts, notes
or code uses were attached. The account is retained pending explicit cleanup
authorization. Private evidence contains the exact UUID, not this public file.
An expired earlier request was retried; Auth logs confirmed expired OAuth state.

## Regression tests

Final candidate: **260/260 passing** (96 Google + 92 onboarding + 72 recovery).
These are new runs after changing the Google release gate, not added to earlier
runs to inflate the total. No functional failures remained before publication.

`OAUTH_PROVIDER=google node tests/interior/oauth-sdk.cjs`: 12 scenarios across
login/signup, 320/1280 and Chromium/WebKit (96 distinct cases). The source flag
is asserted independently; the disabled-gate scenario remains explicitly tested.
Covers existing/new client/trainer profiles, linked identities, rejected callback,
cancellation, settings failure, profile conflict, UUID/role preservation,
persistence and logout. Real SDK with intercepted HTTP; no live fixture accounts.

`AUTH_WIDTHS=320,1280 node tests/onboarding/browser.cjs`: affected onboarding,
email login, profile precedence, navigation and session regressions.
`node tests/onboarding/recovery-feedback.cjs`: recovery acceptance, generic
confirmation, errors, rate limits, duplicate input, stale response and navigation
in light/dark, mobile/desktop and both browser engines. No real email sent.
Results and live-account evidence remain private in ignored results directories.

## Final Google button presentation (27 September)

Reuses the official Google logo from
https://developers.google.com/static/identity/images/g-logo.png, in its original
colors. Source guidelines: https://developers.google.com/identity/branding-guidelines.
Google follows the email form with an `o` separator, a centered visible label,
48px minimum target, focus/hover/pressed/disabled and busy presentation. Only
rendering, scoped CSS and asset version URLs changed; OAuth initiation, callback,
profile creation/linking, roles, logout and session logic are unchanged.

Final affected regression run: **280/280**, replacing rather than accumulating
the earlier total: 96 Google SDK +92 onboarding +72 recovery +20 button scenarios.
`node tests/interior/google-button.cjs` covers Chromium/WebKit, 320/360/390/430/1280,
light/dark, login and signup in each case, logo loading, layout order, centered
text, keyboard focus, busy state, double activation, errors and retry.
These automated suites intercept Auth HTTP; real Google results above are a
separate manual-browser validation. No physical-device or real recovery-email
receipt/password-change validation is claimed. Screenshot/result files are ignored.

Follow-up placement requested on 27 September: the email/password form and its
submit action come first, then `o` and Google. Only DOM placement, spacing and
asset versions change; the 20-case button matrix verifies this updated order.
The preceding 280-case run is historical, not a new run for this placement tweak.

## Independent pending work

Apple requires its own Developer setup, Services ID, callback, signing key and
rotating secret, plus an authorized real test. It and Facebook remain hidden.
Real recovery-email receipt and a real password change remain unverified.

Sources:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-identity-linking
- https://support.google.com/cloud/answer/15549945?hl=en
