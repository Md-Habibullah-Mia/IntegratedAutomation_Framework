# QA Automation Work Log

A running record of the automation work built in this repository — what was
built, what broke, how each issue was actually diagnosed, and how it was
fixed. Written to be presentable: each entry states the symptom, the root
cause, the diagnostic method, and the fix, not just "fixed a bug."

---

## 1. Massive Market — Web Automation

### 1.1 Restructuring the framework for two independent sites

**Context.** The framework was originally scaffolded for a single web
target (`WEB_BASE_URL`, one `testDir`, one set of Playwright projects). The
environment file was updated to carry two separate site URLs
(`MEDCO_WEB_BASE_URL`, `MASSIVE_MARKET_WEB_BASE_URL`) for two unrelated
portals that both need independent test suites.

**Problem found.** `env.config.ts`, `base.page.ts`, and `playwright.config.ts`
still referenced the old single `WEB_BASE_URL` key, which no longer existed.
Nothing errored — `config.webBaseUrl` just silently fell back to a
placeholder default (`https://example.com`), so every test would have
pointed at the wrong place without any visible failure until run.

**Fix.**
- Split config into `medcoWebBaseUrl` / `massiveMarketWebBaseUrl`.
- Changed `BaseWebPage.goto()` to navigate with a relative path and let
  Playwright resolve it against each **project's own** `baseURL`, instead of
  manually concatenating one global URL.
- Restructured `src/web/` into per-site folders
  (`src/web/medco/{pages,tests}`, `src/web/massive-market/{pages,tests}`),
  each with its own Playwright project × browser combination
  (`medco-chromium`, `massive-market-webkit`, etc. — 8 total).
- Updated CI matrix (`site × browser`) and added `test:web:medco` /
  `test:web:massive-market` npm scripts.

**Verification.** `tsc --noEmit` clean, `playwright test --list` confirmed
all 8 projects resolve to the correct test files before anything was run
against a real browser.

### 1.2 Porting real, already-working tests instead of writing from scratch

An existing, working Playwright suite for Massive Market already existed in
a separate repository (`MassiveMarket-Playwright`) with real page objects
for Login, Registration, and Dashboard. Rather than re-deriving locators
from scratch, the working implementation was read and ported verbatim into
the new multi-site structure, preserving details that mattered — e.g.
`RegistrationPage` typing fields with `pressSequentially` (not `.fill()`) to
correctly trigger React's synthetic events on controlled inputs.

### 1.3 Bug — flaky login caused by the wrong navigation wait condition

**Symptom.** The login test passed most of the time, but intermittently hung
until the 30–60s timeout, with no clear cause.

**Diagnosis.** Instead of guessing, the failure artifact's page snapshot
(`error-context.md`, generated automatically by Playwright on failure) was
read directly. It showed the login form fully rendered and interactive —
email pre-filled by the browser, password field ready — while Playwright
was still blocked waiting for the navigation's `load` event, which never
fired. Some background request on the page (analytics/beacon, most likely)
never settled, so the full `load` event was an unreliable signal even
though the page was already usable.

**Fix.** `LoginPage.goto()` was changed to `waitUntil: 'domcontentloaded'`
— the same pattern `RegistrationPage.goto()` already used correctly.
Confirmed with repeated runs (single test, all 4 browsers together, and
under parallel load) — no further hangs.

### 1.4 Bug — mobile registration test timing out near its own limit

**Symptom.** All Massive Market tests passed except registration on
`mobile-chrome`, which failed with `Test timeout of 60000ms exceeded` while
stuck on `"Loading dashboard..."`.

**Diagnosis.** Before assuming this was a real hang (e.g. a mobile-specific
rendering bug), the same test was re-run with a much larger timeout
(120s) to check whether it was slow or actually stuck. It completed in
55.5s — legitimately slower on mobile than desktop (~47–52s), but nowhere
near infinite. The original 60s cap simply left too little margin on a
small, shared dev VM.

**Fix.** Raised the cap to 90s for the registration test specifically
(not globally), with a comment recording *why* the number was chosen.
Blindly increasing every timeout was avoided — only the one test with
demonstrated, measured cause got a bigger number.

### 1.5 Real infrastructure issue — backend rate-limiting, not a test bug

**Symptom.** After many consecutive automated runs during this same
debugging session, login and registration tests that had been passing
started failing again — one with a bare navigation timeout, another with
`page.goto: Could not connect to server`.

**Diagnosis.** Rather than re-tuning timeouts again, the actual rendered
page content in the failure snapshot was read. It contained the literal
text: **"Request was throttled. Expected available in 1044 seconds."**
This was the application's own backend rate limiter reacting to the volume
of registration/login attempts generated by repeated test runs in a short
window — not a defect in the site or the tests.

**Fix.** No code change was the right answer here. Waited for the throttle
window to clear, verified with a single lightweight request first, then
reran the full suite with `--workers=2` to reduce concurrent load on the
small VM. The framework's default `PARALLEL_WORKERS` was permanently
lowered from 4 to 2 in `.env.dev` so this doesn't recur by default.

### 1.6 New test case — Dashboard verification (built from the live app, not guessed)

Rather than writing dashboard assertions speculatively, a temporary
exploratory spec logged in and dumped the page's accessibility tree
(`page.locator('body').ariaSnapshot()`) to see the *real* DOM structure —
navigation links, balance labels, logout control — before writing a single
locator. That exploratory file was deleted once real locators were in hand.

**Cross-viewport bug found this way.** The desktop dashboard shows the
sidebar navigation and a header balance figure directly. On
`mobile-chrome`, the sidebar is collapsed behind an "Open navigation"
button, and the header balance is replaced entirely by an account-details
button — so a naive shared assertion (`expect(navLink).toBeVisible()`)
failed only on mobile.

**Fix.** `DashboardPage.verifyNavigationVisible()` now detects and clicks
the collapse toggle only if it's present, so one spec (`dashboard.spec.ts`,
**TC-003**) works unmodified across all four browser projects. The header
balance assertion was replaced with a check on the "Available Wallet"
label in the main content area, which — unlike the header figure — is
present in both the desktop and mobile layouts.

---

## 2. Odiobuk — API Automation

### 2.1 Starting without the source repository

The Odiobuk project's source repository was not yet available, but a
6-tab QA workbook was: environment/auth notes, a 164-operation endpoint
list (with real enforced auth per route), business rules & limits, known
(non-defect) gaps, open product decisions, and a 223-case manual test
suite with stable TC IDs (`AUTH-001`, `CAT-013`, `OWN-008`, …).

Because the workbook named a live deployed environment
(`https://odiobuk.eastus2.cloudapp.azure.com`) with open interactive docs,
automation started directly against it — the source repo wasn't a
blocker for API-level testing.

### 2.2 AUTH module smoke suite

11 High-priority `AUTH-*` cases from the workbook were automated 1:1 by TC
ID (`AUTH-001` through `AUTH-012`, skipping the ones needing admin/SSH
access or container log access, which weren't available yet):
registration, duplicate-email conflict, weak-password validation, login
(success/failure), reading the authenticated profile, rejecting missing/
malformed tokens, refresh-token rotation (including the negative case of
refreshing with an access token instead), and logout revoking every
outstanding token.

### 2.3 Bug found — inconsistent token response shape across endpoints

**Symptom.** First run: 6 of 12 tests failed, including the most basic one
(`AUTH-001 — Register a new account`), which failed on
`expect(body.access_token).toBeTruthy()` with `access_token` simply
`undefined`.

**Diagnosis.** Rather than guessing at the response shape from the
workbook's shorthand examples, the live endpoints were probed directly
with raw HTTP requests (PowerShell `Invoke-WebRequest`) outside of
Playwright, to see exactly what the server returns:

```
POST /api/auth/register  → { "user": {...}, "tokens": { "access_token": ..., "refresh_token": ... } }
POST /api/auth/login     → same nested shape
POST /api/auth/refresh   → { "access_token": ..., "refresh_token": ... }   ← flat, no "tokens" wrapper
```

Register and login nest their tokens under a `tokens` object; refresh does
not. This inconsistency was the root cause of every failure — including
two tests that looked unrelated (`AUTH-011`, `AUTH-012`), which failed
with the wrong status codes only because they were sending `undefined` as
a token, not because of a real behavioral bug.

**Fix.** Updated the test client's token extraction to match each
endpoint's actual shape. All 12 tests (11 `AUTH-*` + `HEALTH-001`) passed
on rerun against the live server in under 7 seconds.

### 2.4 Framework hygiene fixed along the way

- A pre-existing TypeScript typing bug in `ApiClient.headers()` (a union of
  two incompatible object literal types) was fixed with an explicit
  `Record<string, string>` return type, and a `patch()` method was added
  since the Odiobuk API uses PATCH extensively (admin edits, tier limits).
- The generic placeholder API test (`GET/POST /users` against a fictional
  endpoint) was replaced with a real `HEALTH-001` check against the actual
  `/api/health` endpoint.

---

## 3. Odiobuk — Web UI Automation

### 3.1 A frontend nobody had mentioned yet

The QA workbook described Odiobuk mainly as an API surface, but the
deployed environment turned out to serve a full React web frontend at its
root URL — same host as the API. That made it a third Playwright web
target, added the same way Medco and Massive Market were: its own base
URL, its own `testDir`, its own project × browser matrix (4 more
projects, 12 total across all three sites).

Locators for `login.page.ts`, `registration.page.ts`, and `home.page.ts`
were written from a live accessibility-tree dump of the actual
login/register/home pages — the same explore-first method used for
Massive Market's dashboard, not guessed from the API workbook's
description of the app.

### 3.2 Bug — a mobile header that doesn't make room for a real email

**Symptom.** `TC-002` (login) and `TC-002B` (wrong password) passed on
chromium, firefox, and webkit, but timed out only on `mobile-chrome`
trying to click **Logout**.

**Diagnosis.** The failure log showed the exact interception:
`<span class="user-email">qa_...@test.com</span> intercepts pointer
events`. On a narrow viewport, the header packs the logo, five nav links,
the account email, and the Logout button into one row with no
truncation or collapse — the email text visually sits on top of the
button. This isn't a test artifact: a real user on a phone would tap the
email and miss the button the same way.

**Fix.** Documented the defect in code rather than silently working
around it — `HomePage.logout()` uses a `force: true` click with a comment
explaining exactly why, so the login flow stays testable while the
underlying layout bug remains visible and attributable, not hidden by a
retry loop or a longer timeout.

**Result:** 16/16 passing across chromium, firefox, webkit, and
mobile-chrome.

### 3.3 Correction — the real product is the mobile app

After this phase, it became clear the web frontend isn't actually
Odiobuk's primary surface — the product is the **Flutter mobile app**.
The web tests stay (they're real, passing, and already found a genuine
bug), but UI-automation priority moving forward shifts to **Appium
against the Flutter app** rather than expanding web coverage further.
The mobile app's source turned out to live on its own branch entirely
(`rnd/mobile-application-feature`) in the same GitHub repo as the
backend — separate again from the production backend's own branch
(`r&d/ai-module-pipeline`, nested under `Restful-App/backend/`); neither
is on `main`. Both were checked out locally as **read-only reference
only** — no automation code lives in those repos, all of it stays in this
framework, per an explicit instruction to keep the two cleanly separate.

---

## 4. Odiobuk — Mobile (Appium) Automation

### 4.1 Environment blocker — emulator wouldn't boot at all

Once the real Flutter APK (`memorywave_v2.apk`) was available, the first
attempt to boot the pre-existing `Odiobuk_Pixel_7_API_34` AVD failed
immediately: `x86_64 emulation currently requires hardware acceleration`.
`systeminfo` confirmed every hardware prerequisite was already met (VT-x
in firmware, SLAT, DEP) — the missing piece was purely a Windows feature,
**Windows Hypervisor Platform (WHPX)**, not installed on this machine.
Enabled via Windows Features (admin + reboot required, so this was
handed to the user rather than attempted silently), after which the
emulator booted normally. Worth recording since "the emulator won't
boot" reads like an app or config problem but was neither.

### 4.2 What the app actually is, confirmed rather than assumed

The installed APK's own UI reads "MemoryWave — where every voice is
remembered" on its splash screen, not "Odiobuk." Rather than assume this
was the wrong build, the onboarding carousel was read: "Stories" (2,400+
audiobooks, voice narration), "Voices" (record and preserve a voice),
"Presence" — confirming this is Odiobuk's real product under a
consumer-facing name, not a mismatched artifact.

### 4.3 Building real selectors from a live accessibility dump — same method as web

`adb shell uiautomator dump` was used to walk the actual first-launch
flow (splash → onboarding → entry-point choice → privacy charter → auth
screen → sign-in form) screen by screen, capturing real bounds,
`content-desc`, and class names at each step — the same explore-first
method already used for the web suites' dashboard and login pages,
applied to mobile for the first time. This is what replaced the Phase-1
placeholder selectors (`~login-email` etc.), which had never actually
been run against a real app and turned out to not correspond to
anything real once checked.

**Finding — the sign-in form has an accessibility gap.** The email and
password `EditText` fields carry no semantics label at all: empty
`content-desc`, `NAF="true"` (Not Accessibility Friendly) in the dump.
Every button and message on the same screen ("Sign in", "Continue", "I
already have an account", the error text itself) *does* carry a proper
label — only the two input fields don't. That's a real, narrow
accessibility defect in the app worth flagging, not a testing
inconvenience: a screen reader user would hit unlabeled fields on the
one screen where getting it right matters most. Automated around it
using `UiSelector` by class + instance instead of accessibility id,
since there's nothing else to select on.

### 4.4 Bug — Appium's setValue() silently no-ops on Flutter text fields

**Symptom.** The first full automated run walked the entire onboarding
flow, filled both fields, and tapped Sign in correctly (visible in the
Appium command log — every step succeeded), but then timed out waiting
15s for the "Invalid email or password." error that should follow.

**Diagnosis.** Rather than assume the selector was wrong, a screenshot
was captured immediately after submit. It showed **both fields still
empty**, with the app's own inline validation ("Email is required",
"Password is required") visible — meaning `type()` had run without
error but the text never actually landed. The same manual flow via raw
`adb shell input text` (used earlier during exploration) had worked
perfectly. The difference: `adb input text` always taps a field before
typing into it; Appium's `element.setValue()` sets the value directly
without a prior tap. Flutter's own text-input plugin only attaches to
the platform's input channel once a field is genuinely focused by a
real touch event — a value set without that focus event never reaches
Flutter's `TextEditingController`, and neither WebdriverIO nor Appium
surfaces this as an error; the call just quietly does nothing.

**Fix.** One line in the shared base class, not a per-screen workaround:
`BaseMobileScreen.type()` (`src/core/base.screen.ts`) now calls
`el.click()` immediately before `el.setValue()`. Because every mobile
screen object in this framework extends that base, the fix applies to
every current and future Flutter screen automatically, not just the
login form.

**Result:** `shows an error with invalid credentials` passes end-to-end
against the real APK on a real emulator in ~13 seconds, from a cold
Appium session through the full onboarding flow to a verified real
backend error message.

### 4.5 Real credentials revealed a liveness-check wall, not a bug

Once a real test account was provisioned (`.env.dev.local`), the
previously-skipped valid-login test was un-skipped and run against it.

**What happened.** The credentials were genuinely accepted — a real
"Login successful." toast appeared — but the app then presented a
**First-Login Verification** screen requiring a live face + continuous
speech + head-turn liveness check, not a form field. A first attempt to
capture this screen took a screenshot immediately after submit and
showed the login form still mid-request (buttons visibly disabled) — a
false read, corrected by waiting a few seconds before capturing again
and pulling the real `content-desc` values via `getPageSource()` rather
than guessing.

**Judgment call, not a fix.** Faking this check well enough to pass
would mean feeding the emulator's virtual camera a face image and
injecting synthetic audio — real effort for a feature specifically
designed to reject exactly that kind of non-live input, with no
guarantee of success. Rather than sink time into an uncertain spoof, the
valid-login test was scoped to what's actually being proven: that
authentication succeeds. It now asserts arrival at the verification
screen itself (`~First-Login Verification`), which is real, observable,
and honestly represents what automated login can currently verify — and
left the question of getting further (a pre-verified test account? a
backend bypass flag?) for the user to decide rather than quietly working
around it.

### 4.6 Passing the liveness check the honest way, and what that revealed

With real test credentials in hand, the natural next question was
whether First-Login Verification could be gotten past at all. Rather
than try to synthesize a fake face/voice to fool it — which would cross
from testing into actually spoofing a biometric check, an uncomfortable
line to cross even against the team's own app — the emulator's camera
was pointed at reality instead: `hw.camera.back` was `emulated` (a
synthetic test pattern, confirmed visually), and this machine has a real
webcam, so the AVD config was switched to `hw.camera.back=webcam0` to
pass it through genuinely.

**It worked, with a real person.** Recording live video + audio, the app
tracked face lock and head-turn prompts in real time and completed
verification, landing on the real home screen for the first time —
confirming the account, the backend, and the whole first-login path all
work correctly end to end.

**Then a second run showed the actual limit.** Immediately after,
`login.spec.ts` was re-run through Appium (fresh app install, same
account) — and it landed back on First-Login Verification, not home.
One successful manual pass did not carry forward. Whatever tracks
"already verified" isn't simply a durable flag on the account that a
single completion satisfies for good — at minimum it re-checks per fresh
install, which is exactly what every automated test run does by design.
**Practical conclusion:** this app cannot be meaningfully automated past
login in an unattended/CI sense as it stands — not a gap in the
framework, a real product/backend question worth raising with whoever
owns MemoryWave's auth (e.g. a way to flag known test accounts as
pre-verified). `home.screen.ts` was still written from the one real
session reached, so the moment that question is resolved, coverage can
start immediately instead of from scratch.

### 4.7 Ruling out a simpler explanation before accepting the harder one

Before accepting "this re-verifies every session" as final, the cheaper
explanation was tested first: maybe Appium's own default of wiping app
data before each session (`noReset: false`) was destroying a local
"verified" flag that a real user's app would otherwise keep. Set
`noReset: true` and reran — cleanly this time, without manually clearing
app data first (an earlier attempt at exactly this check was invalid,
undone by an accidental `pm clear` moments before it that resat
everything regardless of the capability being tested).

**Result:** with `noReset: true`, the login session itself demonstrably
persisted — a second run skipped the login form entirely — but it still
landed on First-Login Verification, unverified. So the simpler
explanation was wrong; the harder conclusion from 4.6 holds on solid
evidence. `noReset` was reverted afterward since it only cost the suite
its "every test starts at a fresh login form" assumption without fixing
anything.

### 4.8 Edge cases the login form actually enforces

With the verification question set aside for now, turned to what the
login form itself validates — explored live via `adb` first, same as
every selector in this suite, rather than guessed:

- Empty email → `"Email is required"`
- Empty password → `"Password is required"`
- Malformed email (`not-an-email`) → `"Enter a valid email"`
- A SQL-injection-shaped email (`' OR '1'='1'`) → the same `"Enter a
  valid email"` — rejected by client-side format checking before it
  could reach the network at all. That's not proof the backend itself
  is injection-safe (a field that actually reaches the server would be
  needed for that — the API suite's job), but it does confirm the
  mobile client doesn't do anything unsafe with the raw string.

All four are now real, passing test cases.

### 4.9 What's intentionally not automated yet

Everything past the "First-Login Verification" liveness screen —
library browsing, playback, voice recording/preservation, and the admin
account's own flows (credentials provisioned in `.env.dev.local` as
`MOBILE_TEST_ADMIN_EMAIL`/`PASSWORD`, not yet exercised by any test) —
is unautomated until that gate is resolved one way or another. iOS
(XCUITest) automation is intentionally not started — Android first, per
the plan, once an iOS build exists.

### 4.10 A source-derived test case matrix, without touching the gated login flow

Asked for a full manual/formal test case matrix — TC ID, Title,
Preconditions, Steps, Expected Result, blank Actual Result — covering
the whole app, explicitly without running signup/signin/verification
(that gate had just cost real manual effort to clear and wasn't to be
disturbed). Rather than write cases from memory, read the actual
Flutter source screen by screen (`D:\My Projects\Audiobook-mobile\lib\`)
— real validators, real error strings, real API calls — splitting the
~9,500-line codebase across four parallel background agents by feature
area while personally covering auth/onboarding/verification directly,
since that area already had the deepest live context from prior phases.

**285 test cases** came out of it, delivered as an Excel workbook (one
sheet per area). A few real findings surfaced purely from reading code:
registration silently auto-logs the user in and sends them to
verification despite a "please log in" message; email validation
everywhere is just "contains @"; there's no retake option anywhere in
the voice-recording flow; several player features (offline download,
bookmarks, sleep timer) are toast-stub placeholders. 59 of the 285
cases (everything touching signup/login/verification, plus logout and
account deletion) were explicitly flagged as held back per standing
instruction, not silently included.

### 4.11 Automating the first batch — and two more real bugs, not app bugs

With the session reconfirmed still logged in and verified, set
`noReset: true` back on (this time correctly understood: it keeps an
*already-authenticated* session alive across Appium runs, not — as a
failed earlier attempt in 4.7 hoped — a way to get *past* verification
itself). Explored Home, Player, and Book Pages live to ground new page
objects in real selectors, then wrote and ran `home.spec.ts` against
the real account.

Two bugs turned up while automating, both root-caused before assuming
either the app or Appium was at fault:
- **Ambiguous selector.** The PDF card and its own generated audiobook
  share the same filename prefix, so a loose `starts-with` XPath tapped
  the wrong one. Fixed by requiring the PDF selector to also match
  "pages" in its label.
- **A real dead-zone tap bug.** Tapping the PDF card did nothing —
  silently, no error. Before blaming the test framework, reproduced it
  with a raw `adb shell input tap` at the exact same coordinate Appium
  was using: still nothing. The card's accessibility bounds span the
  full screen width, but the actual tappable area is only the leading
  icon+text — the trailing whitespace is dead. `element.click()` taps
  the bounds' center by default, landing right in that gap. Fixed with
  a new `clickNearStart()` helper on the shared base screen class,
  since this is a full-width-row pattern likely to recur once Library
  and Voices get automated.

Also hardened the suite itself: `noReset: true` means Appium attaches
to whatever screen a prior run left the app on rather than relaunching
fresh, so one failed test used to cascade into every later one in the
file. Added a `beforeEach` that presses back until Home is confirmed
visible before each test runs.

**Result:** 6/6 tests passing reliably across repeated runs (~12s each),
covering HOM-003, HOM-011, HOM-013, HOM-016 and cross-referencing
AUD-034/LIB-023/LIB-024 — Actual Result marked Pass for all seven in the
workbook. ~220 eligible cases remain, to continue area by area.

### 4.12 Four more areas, and two assumptions that didn't survive contact with the live app

Continued into Library, Voices, Profile, and Vault in the same session,
same explore-first discipline throughout. Two assumptions carried over
from earlier exploration turned out to be wrong once actually checked
live, which is exactly the reason for checking live instead of trusting
notes: the Public shelf's default category was assumed to be "Voice"
(true earlier in the session, probably after an incidental manual tap)
— a genuinely fresh visit defaults to "Audiobook" instead. And the
Public shelf's PDF category was assumed to show the account's own
uploaded PDF; it actually shows the store catalogue (sample titles like
"The Hobbit") — the personal upload only lives under Your Library. Both
caught by reading what actually rendered rather than asserting on what
was expected to.

**A worse version of the Phase 14 dead-zone bug.** Pressing Android
"back" too many times from a bottom-nav tab doesn't just land on the
wrong screen — it exits the app to the launcher entirely. The fix
(`HomeScreen.ensureDisplayed()`) caps back-presses at 2 and relaunches
the app as a guaranteed-safe fallback, confirmed live to correctly
re-resolve session and verification state rather than losing them.

**A scroll-dependent variant of the same family, on Profile.** "Private
vault" sits at the bottom of a Flutter-merged, multi-row info block,
below the fold on first load. A single scroll wasn't reliably enough —
in one run, a swipe gesture silently did nothing at all, being the very
first gesture of a fresh session. Fixed by scrolling in a loop that
checks for a marker only visible once fully scrolled ("Log out"),
instead of trusting any fixed number of swipes.

**A process mistake, caught before it became silent data loss.** The
first Excel update landed only in a copy of the workbook (made because
the original was open in Excel at the time) — and that copy was later
deleted without merging its results back into the original first.
Caught by checking the total Pass count against what was expected
before reporting the work done, not by assuming the save had worked;
fixed by reapplying all 26 results to the original file once it was
free to write to again. Worth keeping as a reminder to verify a
write actually landed where intended, not just that it landed somewhere.

**Result:** 20 tests across 5 spec files (`home`, `library`, `voices`,
`profile`, `vault`), all passing together in one run with zero
failures. 26 of 285 test cases now marked Pass in the workbook.

### 4.13 A real generation end to end, and the recovery helper's real weak spot

Directed to use only existing voices and to test the account's paid
entitlement. Bought a catalogue title live (mock payment, same path as
Profile's Upgrade dialog), generated a narration from it with an
existing voice, and watched it finish — in under a second, not the
"10–15 minutes" the app's own dialog promises. Worth recording as a real
gap between UI copy and observed behavior for short texts, not
something to quietly correct in the test instead of flagging.

Two more bugs, one trivial and one not. The trivial one: a selector
object property called as if it were an instance method
(`this.chapterButton(1)` when `chapterButton` lived on `SELECTORS`, not
on the class) — TypeScript didn't catch it because `this.chapterButton`
was just `undefined`, not a type error, until it ran. Fixed by making it
a standalone function so the mistake has no name left to make.

The real one: this suite's deeper navigation (Library → detail sheet →
form → player) finally stress-tested `HomeScreen.ensureDisplayed()`
enough to expose that its "relaunch the app" fallback wasn't actually
resetting anything — `mobile: activateApp` just foregrounds a still-
running process, confirmed live by watching it resume exactly on
Library instead of Home. It had only ever *looked* like a working
fallback because every earlier failure happened to follow a real process
kill first. Rewrote it to tap the Home tab directly (the tabs are
siblings in an `IndexedStack`, not a push stack — "back" was never
really the right tool here) and to actually terminate-then-restart the
process as the genuine last resort.

**Result:** 23 tests across all 6 spec files, run together, zero
failures — confirming the rewritten recovery helper didn't break
anything it now underpins. 30 of 285 test cases marked Pass.

---

## 5. Repository hygiene — secrets

Test account credentials (`LOGIN_TEST_EMAIL`, `LOGIN_TEST_PASSWORD`,
`REGISTRATION_TEST_PASSWORD`, `TEST_PHONE`) were initially added directly
to `.env.dev`, which — unlike `.env` in the original `MassiveMarket-Playwright`
repo — is **tracked** in this repository's git history (explicitly
un-ignored via `!.env.dev`). That would have committed plaintext
credentials.

**Fix.** Moved secrets into a new `.env.dev.local` file, confirmed with
`git check-ignore` that it's excluded by the existing `.env.*` gitignore
pattern, and updated `env.config.ts` to load both files (`.env.dev` for
committed, non-secret config; `.env.dev.local` layered on top for local
secrets) — the same split the original repository already used correctly.

---

## Skills this work demonstrates

- Reading Playwright's own failure artifacts (`error-context.md`, page
  snapshots) as the primary diagnostic tool, instead of guessing and
  re-running.
- Distinguishing a real defect from test flakiness from infrastructure
  behavior (rate limiting) — three different failure classes that looked
  similar at first (`Test timeout exceeded`) but needed three different
  fixes (none of which was "just raise the timeout").
- Building locators from a live, running application's actual accessibility
  tree rather than assumption, and designing one test that adapts correctly
  across desktop and mobile viewports instead of forking per-viewport logic.
- Automating against a live API using only a QA workbook and no source
  access, and verifying assumed request/response contracts with direct
  HTTP probing before trusting them in test code.
- Basic repository/secrets hygiene (gitignore review before committing
  credentials).
- Reporting a real product defect (the mobile header overlap) in code and
  docs instead of quietly working around it with a longer timeout.
- Judgment about which surface actually matters to test — recognizing
  that a working web frontend isn't the same as the product's real
  surface, and re-prioritizing to the mobile app once that was clear.
- Keeping automation code and application source cleanly separated across
  repositories, even while actively cross-referencing the source for
  accuracy.
- Diagnosing a platform-level environment blocker (missing Windows
  Hypervisor Platform) from an emulator error message, distinguishing it
  from an app or config problem, and handing the fix to the user rather
  than attempting a silent, unauthorized system change.
- Extending the explore-first, accessibility-tree method from web to
  mobile, and reading that same dump critically enough to catch a real
  accessibility defect in the app (unlabeled input fields) instead of
  just harvesting selectors from it.
- Root-causing a silent framework bug (`setValue()` no-op on Flutter
  fields) by comparing a working manual path against a failing automated
  one and isolating the one behavioral difference between them, then
  fixing it once at the shared base-class level instead of patching the
  symptom in a single test.
- Deriving a full formal test case matrix directly from application
  source rather than assumption, parallelizing the reading work across
  multiple agents while personally owning the highest-context area, and
  respecting an explicit scope boundary (no signup/login/verification)
  throughout without needing to be reminded.
- Root-causing a second silent bug (a dead-zone tap on a full-width
  list row) by reproducing it with a raw manual input first, ruling out
  the test framework as the cause before writing a fix — then fixing it
  once at the shared base-class level since the same row pattern
  recurs elsewhere in the app.
- Treating an earlier session's own exploration notes as a hypothesis to
  re-check, not a fact to build on — catching two stale/wrong assumptions
  (default category, which shelf shows which PDF) by reading what the
  live app actually rendered before writing assertions against it.
- Catching a self-inflicted data-loss risk (an Excel update that landed
  in a copy, later deleted without merging back) by verifying an actual
  outcome — total Pass count — against expectation before reporting
  completion, rather than assuming a save had worked because the command
  succeeded.
