# Key constants

## Roles (descending authority)

super_admin → ceo → agm → manager → receptionist. super_admin/ceo always
full access, no exceptions.

## Scoring

- star = `(rating/5)*100`
- MC = option score
- numeric_scale = `((val-1)/9)*100`
- weighted, sums to 100 per form (per tab independently for Visit
  Journey two-stage forms)
- skipped/branched-hidden questions excluded from denominator
- server-side only, never client-computed
- `DEFAULT_LOW_SATISFACTION_THRESHOLD = 50` — shared constant, use
  everywhere, never hardcode a separate fallback value

## Google review

Threshold 90% default, server-side, client only receives `showQr`
boolean. Suppressed entirely for drop_off stage sessions (customer
hasn't seen the car yet — this suppression is SPECIFIC to the Google
Review QR, not a general rule — do not apply the same suppression to
unrelated features like announcements without being told to).

## Facility singleton ID

`00000000-0000-0000-0000-000000000000`

## DeepSeek usage

- Model: `deepseek-v4-flash` only, always `thinking:{type:'disabled'}`
- Temperature varies by feature: 0.2 for reports/domain-inference,
  0.7 for form generation/closing questions
- `thinking:{type:'disabled'}` eliminates reasoning tokens (250–450
  otherwise), brings output to 33–43 tokens with `max_tokens: 120`
- Reserve DeepSeek for high-frequency, low-stakes, single-shot calls
  (translation, ticket structuring, closing question generation).
  For lower-frequency but higher-stakes multi-step work (investigating
  a bug across files, drafting a code patch), that's a materially
  harder task class — flag it to Fahim rather than assuming DeepSeek
  is the right tool by default.

## AI closing question pattern

Wait-then-lock: spinner shown on reaching closing step, waits up to
2500ms, then locks (AI-generated or static fallback). No hot-swap after
customer has seen the question. Arabic sessions show static immediately,
no spinner.

## Pick-up feedback happens before invoicing

Customer hasn't seen the finished car yet at pick-up feedback time —
car-condition/quality questions are genuinely unanswerable at that
stage, not just awkward. Keep this in mind for any new pick-up-stage
question or feature design.

## receptionist KPI scoring

`computeReceptionistImpact` deliberately does NOT use blended visit
score — each receptionist is credited on their own session score only,
to prevent cross-contamination between two staff members who handled
different halves of the same visit. Intentionally inconsistent with
session detail/reports; stays this way until a dedicated Receptionist
KPI question-tagging module exists (currently parked/not built).

## Latency context

Frankfurt + Frankfurt (Vercel + Supabase) = ~1ms per DB call.
Previously Mumbai + Frankfurt was ~120ms per call — this is why Vercel
was moved to Frankfurt.
