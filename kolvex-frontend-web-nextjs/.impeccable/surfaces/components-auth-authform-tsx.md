---
version: 1
slug: "components-auth-authform-tsx"
primary_target: "components/auth/AuthForm.tsx"
related_targets: ["components/auth/AuthLayout.tsx","components/auth/ForgotPasswordForm.tsx","components/auth/ResetPasswordForm.tsx","components/ui/input.tsx","components/ui/password-input.tsx"]
---

# Authentication

Mode: Operate. Scope: login, signup, forgotten password and reset-password presentation.
User request: unify auth controls and redesign inconsistent inputs shown in the supplied screenshot, matching the homepage/dashboard.

## Direction contract

THESIS: Authentication is one coherent entry into Kolvex. Remove mismatched field chrome, bilingual leakage and divergent recovery forms.
OWN-WORLD: Inherit the dashboard's semantic themes, Inter/Chinese stack, flat 12px bordered surfaces, shared pill buttons and native form affordances.
STORY: Choose login or signup, enter clearly labelled values, correct inline errors, and continue; recovery shares the same structure.
FIRST VIEWPORT: One centered 440px reading column, a quiet bordered panel, 30px heading, underlined shared tabs, aligned 48px inputs and full-width actions. At 390px, use 16px outer and 24px panel padding, preserving document scrolling.
FORM: Code-led refinement of the established visual world. Seed not applicable per new-work section 3 (local refinement); screenshot is diagnostic evidence, not a comp to clone. Signature interaction: consistent keyboard focus and password visibility, not decorative motion.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: keep existing routes, auth services, account/session rules, minimum password length (backend 6) and redirect behavior. Preserve password manager/paste support. Do not create accounts, send reset emails or change real credentials during browser checks. No Japan-specific scope.
