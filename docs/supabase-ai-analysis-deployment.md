# Supabase AI analysis deployment verification

Verified on 2026-10-09 for the repository-configured Supabase project
`kolvex-backend` (`zekbqxpgivgznhnheima`, us-east-2, ACTIVE_HEALTHY).

The two required migrations had already been applied remotely. Their stored SQL
hashes exactly match the repository SQL; no duplicate DDL was executed. Local
filenames have been aligned with their actual remote migration versions:

| Remote version | Migration | SQL MD5 |
| --- | --- | --- |
| 20261009102844 | stock_analysis_history | 25c0fcc3a02bde998eb8010050ee4f6c |
| 20261009104736 | separate_ai_analysis_and_drawings | 54cecb0c71d800421819aa2dccc6ae48 |

## Verified database behavior

- Both `stock_analysis_versions` and `stock_analysis_heads` exist with RLS enabled.
- SELECT policies restrict authenticated readers to their own user ID.
- Anonymous users cannot read either table; authenticated users cannot insert or update.
- Snapshot save/activate functions use SECURITY INVOKER with an empty search path.
  Only the service role can execute the save and activate RPCs.
- Kind constraints support `technical`, `drawings`, and `research`.
- The research capture trigger is enabled; all 24 completed research records at
  verification time have captured snapshots.
- The repository SQL assertion suite passed against the remote project inside a
  transaction: immutable version retention, recorded bars, version activation,
  conflict detection, ownership checks, research capture, snapshot survival, and
  independent text/drawing current pointers.
- Synthetic test tickers used unique uppercase suffixes to match the research
  trigger's symbol normalization. All test writes were rolled back.

This confirms the database portion only. It does not publish Next.js or Python
application code; those use their existing hosting/deployment workflows.

## Existing advisor findings outside this change

No security advisor finding referenced the new analysis tables or functions.
Existing project warnings were recorded without changing unrelated authentication
or database behavior:

- Four older functions have mutable search paths: `update_chat_conversation_updated_at`,
  `handle_new_user`, `update_user_api_keys_updated_at`, `update_updated_at_column`.
  [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- `handle_new_user` is SECURITY DEFINER with EXECUTE granted to anonymous and authenticated roles.
  [Anonymous-role remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [authenticated-role remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Leaked-password protection is disabled.
  [Password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Remote changes remain tracked by migration history, consistent with
[Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).
