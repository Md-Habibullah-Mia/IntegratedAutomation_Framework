# Development Log

How this framework grew, phase by phase — not a commit log, a record of
*why* each piece exists. Each phase carries a `Date:` line as its own
element; delete just that line if a dated version isn't wanted later,
nothing else needs to change.

This is a living document — new phases get appended as the framework grows.

---

## Phase 1 — Single-site scaffold (starting point)

**Date:** *(before this log started)*

The framework began as a generic, single-target scaffold: one
`WEB_BASE_URL`, one `testDir`, one set of browser projects
(`chromium` / `firefox` / `webkit` / `mobile-chrome`), plus placeholder
mobile (Appium/WebdriverIO) and API (Playwright request context) suites
sharing one `core/` layer (`BaseWebPage`, `BaseMobileScreen`, `ApiClient`,
`logger`). Built to prove the architecture — page objects extending a
common base, `.env.<env>` per environment — with one worked example
(a generic Login flow) rather than a real target.

---

## Phase 2 — Multi-site framework restructuring

**Date:** 2026-08-31

**Trigger.** `.env.dev` was updated to carry two independent site URLs —
`MEDCO_WEB_BASE_URL` and `MASSIVE_MARKET_WEB_BASE_URL` — for two unrelated
portals that both need their own test suites, but the framework still only
understood one `WEB_BASE_URL`.

**What changed.**
- `env.config.ts`: `webBaseUrl` → `medcoWebBaseUrl` / `massiveMarketWebBaseUrl`.
- `base.page.ts`: `goto()` now navigates a relative path and lets
  Playwright resolve it against each **project's own** `baseURL`, instead
  of manually concatenating one global URL.
- `src/web/` restructured into per-site folders
  (`src/web/medco/{pages,tests}`, `src/web/massive-market/{pages,tests}`).
- `playwright.config.ts` now generates one project per `site × browser`
  pair (8 total: `medco-chromium` … `massive-market-mobile-chrome`), each
  with its own `testDir` and `baseURL`.
- CI matrix (`.github/workflows/ci.yml`) updated to `site × browser`;
  added `test:web:medco` / `test:web:massive-market` npm scripts.

**Verified with:** `tsc --noEmit` (clean) and `playwright test --list`
(confirmed all 8 projects resolve to the right files) — before running a
single real browser.

---

## Phase 3 — Porting a real, working test suite

**Date:** 2026-08-31

An existing, already-working Playwright suite for Massive Market existed
in a separate repository, with real page objects for **Login**,
**Registration**, and a **Dashboard** helper. Ported verbatim into the new
`src/web/massive-market/` structure rather than re-derived from scratch —
including implementation details that mattered, like
`RegistrationPage` typing fields with `pressSequentially` (not `.fill()`)
to correctly trigger React's synthetic events on controlled inputs.

Also fixed while integrating:
- A flaky `LoginPage.goto()` (default `waitUntil: 'load'` hung
  intermittently on a background request that never settled) — switched
  to `domcontentloaded`, matching the pattern `RegistrationPage` already
  used correctly.
- A too-tight timeout on the registration test under mobile viewport load
  (measured actual duration before raising the cap — 90s, not an arbitrary
  round number).
- Real test-account secrets accidentally added to a **git-tracked**
  `.env.dev` — moved into a new, confirmed-gitignored `.env.dev.local`.

---

## Phase 4 — Diagnosing a false "hang": backend rate-limiting

**Date:** 2026-08-31

After repeated automated runs in one session, previously-passing tests
started failing with timeouts and connection errors. The failure
snapshot's rendered page content read: *"Request was throttled. Expected
available in 1044 seconds."* — the application's own backend rate limiter,
not a defect. Waited it out, verified with one lightweight request, then
permanently lowered `PARALLEL_WORKERS` from 4 to 2 in `.env.dev` so the
default run profile doesn't retrigger it.

---

## Phase 5 — Dashboard test case, built from the live app

**Date:** 2026-08-31

**TC-003** (dashboard verification) was authored by first exploring the
*real* running dashboard — a throwaway spec dumped the live accessibility
tree (`ariaSnapshot()`) after logging in, which was then deleted once real
locators were written from it. That exploration surfaced a genuine
cross-viewport difference: the mobile layout collapses the sidebar
(navigation + logout) behind an "Open navigation" toggle and swaps the
header balance figure for an unrelated control. `DashboardPage` now opens
the sidebar only when the toggle is present, and checks a stable
"Available Wallet" label instead of the viewport-dependent header figure —
one spec, unmodified, passing on all four browser projects.

---

## Phase 6 — API automation added: Odiobuk

**Date:** 2026-09-01

**Trigger.** A second, unrelated product entered scope — Odiobuk, an AI
audiobook platform (voice cloning, narration generation, a 164-operation
API) — arriving as a 6-tab QA workbook (environment/auth notes, the full
endpoint list with real enforced auth, business rules & limits, known
non-defect gaps, open product decisions, and a 223-case manual test suite
with stable TC IDs) **before the source repository was available.**

**What changed.**
- `env.config.ts` / `.env.dev`: added `odiobukApiBaseUrl`, pointed at the
  live deployed environment (`https://odiobuk.eastus2.cloudapp.azure.com`)
  — API testing didn't need to wait on repo access.
- `core/api-client.ts`: fixed a pre-existing TypeScript typing bug in the
  header builder, added a `patch()` method (the platform's admin routes
  use it heavily).
- `api/tests/health.spec.ts`: replaced a fictional placeholder test
  (`GET/POST /users` against an endpoint that doesn't exist) with a real
  `HEALTH-001` check against `/api/health`.
- `api/tests/auth.spec.ts` (new): 11 cases automated 1:1 against the
  workbook's own TC IDs (`AUTH-001`–`AUTH-012`, minus the ones needing
  admin/SSH or container-log access not yet available).

**Bug found.** First run: 6 of 12 failed, including registration itself,
on `access_token` being `undefined`. Rather than guess from the
workbook's shorthand, the live endpoints were probed directly with raw
HTTP requests outside Playwright — revealing that `register`/`login`
nest their tokens under a `tokens` object while `refresh` returns them
flat. Fixed the test client's extraction per-endpoint; all 12 checks
passed against the live server in under 7 seconds on rerun.

---

## Phase 7 — Documentation as part of the process

**Date:** 2026-09-01

Work going forward is documented as it happens, not reconstructed after
the fact — this file, `docs/QA_WORK_LOG.md` (the narrative, bug-by-bug
version of the same work), and a shareable summary page are kept in
parallel with the automation itself.

---

## Phase 8 — Odiobuk added as a third web site

**Date:** 2026-09-02

**Trigger.** The deployed Odiobuk environment turned out to serve a full
React web frontend at its root URL (`https://odiobuk.eastus2.cloudapp.azure.com/`,
same host as the API) alongside the backend — not just an API surface.

**What changed.**
- `env.config.ts` / `.env.dev`: added `odiobukWebBaseUrl`.
- `playwright.config.ts`: `odiobuk` added to the `sites` array — 4 more
  projects (`odiobuk-chromium` … `odiobuk-mobile-chrome`), 12 total across
  all three sites.
- `src/web/odiobuk/{pages,tests}` (new): `login.page.ts`,
  `registration.page.ts`, `home.page.ts` — written from a live
  accessibility-tree dump of the real login/register/home pages, same
  explore-first method used for Massive Market's dashboard.
- **TC-001** (registration), **TC-002 / TC-002B** (login success and wrong
  password), **TC-003** (home + navigation) — self-contained, each
  registers its own throwaway account rather than depending on a fixed
  seeded one.

**Bug found.** `TC-002`/`TC-002B` failed only on `odiobuk-mobile-chrome`:
clicking Logout timed out because the account's email address overlaps
the Logout button on narrow viewports — the header doesn't truncate a
long email, so it visually sits on top of the button and intercepts the
click. A real user on mobile would hit the same problem. Worked around
in the test with a documented `force: true` click so the flow stays
testable; the overlap itself is a real product defect, not a test issue.

**Result:** 16/16 passing across all 4 browser projects.

---

## Phase 9 — Correction: Odiobuk's real surface is the mobile app

**Date:** 2026-09-02

The user clarified that Odiobuk's actual product is the **Flutter mobile
app**, not the web frontend built in Phase 8 — real users are on mobile.
The web frontend exists and the Phase 8 tests stay (they're real and
already found a genuine bug), but going forward, UI automation priority
shifts to **Appium against the Flutter app** rather than further web-UI
expansion. Source for the mobile app was located on the `Audiobook`
GitHub repo's `rnd/mobile-application-feature` branch (a separate branch
from the production backend, which lives on `r&d/ai-module-pipeline`
under `Restful-App/backend/` — neither is on `main`). Both are checked
out locally as read-only reference (`D:\My Projects\Audiobook`,
`D:\My Projects\Audiobook-mobile`) — automation code stays entirely in
this framework and never touches those repos.

---

## Phase 10 — First real mobile (Appium) test: MemoryWave Android login

**Date:** 2026-09-09

**Trigger.** Odiobuk's real Flutter APK became available
(`memorywave_v2.apk`, from `D:\My Projects\Audiobook-mobile`) — the first
chance to replace the Phase 1 placeholder mobile scaffold (generic
`~login-email` / `~login-password` guesses, never run against a real
app) with a real, verified Android suite.

**Environment setup.** Copied the APK into `apps/` (gitignored — 85MB
binary, `.env.dev`/`.env.dev.local` point at it, not committed).
Confirmed the real package/activity via `aapt dump badging`
(`com.ad.audio_book` / `.MainActivity` — the existing placeholder default
happened to already be correct). Booting the `Odiobuk_Pixel_7_API_34`
AVD initially failed — "x86_64 emulation currently requires hardware
acceleration" — because Windows Hypervisor Platform (WHPX) wasn't
enabled on this machine; enabled it via Windows Features + reboot, after
which the emulator booted normally.

**What the app actually is.** The APK's own UI brands it "MemoryWave —
where every voice is remembered," not "Odiobuk" — confirmed via its
onboarding copy ("Stories" = 2,400+ audiobooks, "Voices" = voice
preservation/cloning, "Presence") that this is the same product under a
different in-app name, not a wrong build.

**Explored live, same method as the web suites.** Used
`adb shell uiautomator dump` (not guesswork) to walk the real first-launch
flow — splash → onboarding highlights → entry-point choice → privacy
charter → auth screen → sign-in form — and capture real selectors at
each step. Two real findings came out of that exploration, not assumed:
- The email/password `EditText` fields carry **no accessibility label at
  all** (empty `content-desc`, `NAF="true"` in the dump) — a genuine
  accessibility gap on the app's own sign-in form. Selectors had to fall
  back to `UiSelector` by class + instance instead of accessibility id.
- Submitting invalid credentials produces a real backend-driven error
  ("Invalid email or password.", rendered as a Flutter SnackBar whose
  semantics label *is* the message) — proving the auth backend is live,
  which contradicts `.env.dev.local`'s stale "no real backend yet"
  comment (left uncorrected there as a local-only file, but noted here).

**Bug found in the framework itself, not the app.** The first real test
run got through the entire onboarding + form-fill + submit flow but the
error never appeared — `getErrorMessage()` timed out. A debug screenshot
taken right after submit showed both fields still empty with inline
"Email is required" / "Password is required" validation, even though
`type()` had just run. Root cause: Flutter's text-input plugin only
wires up once a field is actually focused by a real tap — WebdriverIO's
`setValue()` alone silently no-ops on a Flutter `EditText` if the field
wasn't clicked first. Manual `adb shell input text` exploration hadn't
hit this because `adb input` always taps-then-types. Fixed in
`BaseMobileScreen.type()` (`src/core/base.screen.ts`) by adding an
explicit `el.click()` before `el.setValue()` — a one-line fix, but one
that affects every current and future screen object in the mobile suite,
Odiobuk or otherwise.

**New files.** `src/mobile/screens/onboarding.screen.ts` (conditional,
idempotent walk through the one-time first-launch flow — safe to call
even if a session starts mid-flow) and a rewritten
`src/mobile/screens/login.screen.ts` / `src/mobile/tests/login.spec.ts`.

**Result:** `shows an error with invalid credentials` passes end-to-end
against the real APK on a real emulator (~13s). `logs in successfully
with valid credentials` is written but `it.skip`'d — no provisioned
MemoryWave test account exists yet, and first sign-in additionally
requires a face & voice verification step per the app's own copy, not
modeled yet. Next: get a real test account provisioned, then iOS
(XCUITest) once an iOS build is available.

---

## Phase 11 — Real credentials confirm auth works; found the actual wall

**Date:** 2026-09-10

A real MemoryWave test account (`MOBILE_TEST_EMAIL`/`MOBILE_TEST_PASSWORD`,
plus a provisioned `MOBILE_TEST_ADMIN_EMAIL`/`MOBILE_TEST_ADMIN_PASSWORD`
for later admin-flow coverage) was added to `.env.dev.local` and wired into
`env.config.ts` (`config.mobile.testAccount` / `adminAccount`). The
previously-skipped valid-login test un-skips itself automatically once
those env vars are present — no code change needed to enable it.

**What running it live actually showed.** The credentials are accepted —
a real "Login successful." toast fires — but the app then routes to a
**"First-Login Verification"** screen: a live liveness check ("Press
Start, keep speaking continuously, and follow the head-turn prompts.
Detection is automatic."), not a form. This isn't specific to a brand-new
account, as the Phase 10 assumption held — it happened on first use of
this specific test account too, so it may gate on account or device state
generally rather than strictly "first ever sign-in."

**Decision made about where the test's boundary is.** Rather than attempt
to fake a face + continuous speech + head-turn liveness check (would
require the emulator's virtual-scene camera and an injected audio feed,
with no guarantee a static asset satisfies "liveness" detection designed
specifically to reject that), the valid-login test now asserts arrival at
`~First-Login Verification` — the real, honest, verifiable proof that
authentication itself works. Diagnosed the same way as the Phase 10 bug:
a debug screenshot taken immediately after submit initially showed a
false negative (buttons still mid-request); a second one taken after a
short wait showed the true destination, from which the real
`content-desc` selectors ("First-Login Verification", "Start
Verification") were read via `getPageSource()`.

**Open question, not resolved here:** how (or whether) to get an
automated account past this gate — e.g. asking whoever owns the backend
for a way to mark a test account as pre-verified, versus investing in
camera/mic emulator injection with uncertain payoff. Left open for the
user to decide before going further into post-login coverage (library
browsing, playback, admin flows).

---

## Phase 12 — Getting past First-Login Verification: real webcam, real human, real finding

**Date:** 2026-09-10

Chose, deliberately, not to fabricate a face/audio feed to spoof the
liveness check (a step beyond "test automation" and into deepfake-style
spoofing territory, even against the team's own app). Instead took the
honest route: the AVD's `hw.camera.back` was `emulated` (a synthetic
color-bar test pattern — visibly not a face, confirmed via screenshot).
This machine has a real webcam ("HP HD Camera", confirmed by `emulator
-webcam-list` as `webcam0`), so the AVD's `config.ini` was changed to
`hw.camera.back=webcam0`, passing the real host camera through to the
emulator (cold boot required to pick it up). Verified the change worked
by screenshotting the verification screen's live preview before and
after — synthetic bars, then a real (blurry, unfocused) room shot.

**The actual check, completed live.** With a real person in front of the
webcam, the app recorded live video + audio ("Recording video + audio
(ML Kit face detection)"), prompted "Look FORWARD", tracked face-lock
and head-turn state in real time, and completed successfully — landing
on the real authenticated home screen ("Good morning, Kazi", 2
audiobooks, 1 PDF, HOME/TODAY/LIBRARY/VOICES nav) for the first time.
`src/mobile/screens/home.screen.ts` was written from a live accessibility
dump of that real screen.

**The finding that actually matters here.** Immediately after that
success, the existing automated `login.spec.ts` was re-run against a
freshly-cleared app install with the same account — and it hit
**First-Login Verification again**, not the home screen. So this isn't a
one-time-per-account gate that a single manual pass permanently clears;
it re-triggers per session/install regardless of the account's prior
verified history (at least under a fresh app-data install — whether it's
keyed to device state, session state, or something else server-side
wasn't isolated further here). This means unattended/CI mobile
automation genuinely cannot get past login as currently built — every
automated run would need a live human at the webcam, which defeats the
purpose of automating it. This is now a real constraint to raise with
whoever owns the MemoryWave backend, not a framework gap to code around.

**Net result:** `home.screen.ts` exists and is ready, built from a real
screen, but nothing yet exercises it automatically — doing so requires
either resolving the re-verification question above, or repeating a
live-assisted pass like this one per exploration session.

---

## Phase 13 — Ruling out Appium reset as the cause, then real edge cases

**Date:** 2026-09-10

**Testing (and rejecting) a hypothesis.** Before accepting Phase 12's
conclusion, the obvious alternative explanation was tested: Appium's
default `noReset: false` wipes app data before every session, so maybe
"already verified" was a local flag getting wiped by *Appium*, not a
real per-session backend requirement. Set `'appium:noReset': true` in
`wdio.conf.ts` and re-tested properly — critically, *without* manually
clearing app data first (an earlier attempt at this same check was
invalidated by an accidental `adb shell pm clear` right before it,
which of course reset everything regardless of the capability).

**Clean result: hypothesis rejected, original finding confirmed.** With
`noReset: true`, a second run correctly skipped the login form entirely
(the session token persisted — `noReset` was working as intended) and
landed directly on First-Login Verification anyway. So the login
session persisting does *not* carry the verification status with it —
confirming Phase 12's finding on solid evidence instead of a flawed
test, rather than reversing it. `noReset: true` was reverted afterward
since it broke the assumption (every other test needs a fresh login
form) without buying anything real.

**Real edge cases, explored live before being encoded.** With the
verification question set aside per the user's direction, turned to
what's actually reachable and automatable without it: the login form's
own validation. Manually walked through empty-email, empty-password,
malformed-email, and a SQL-injection-shaped input via `adb`, same
explore-before-code method as everywhere else in this suite:
- Empty email → `"Email is required"` (inline, not the submit-flow error
  banner `getErrorMessage()` was built for — checked directly instead).
- Empty password → `"Password is required"`.
- Malformed email (`not-an-email`) → `"Enter a valid email"`, a
  client-side format check.
- `' OR '1'='1'` as the email → the *same* `"Enter a valid email"` —
  the string isn't email-shaped, so client-side format validation
  rejects it before any network call. Not proof the backend is
  injection-safe (that needs a field that actually reaches the server —
  a job for the API suite), but confirms the mobile client itself
  doesn't do anything unsafe with the raw string.

All four encoded as real test cases in `login.spec.ts`; full suite (6
tests) passes end-to-end in ~2 minutes.

---

## Phase 14 — A source-derived test case matrix, then automating the first batch

**Date:** 2026-09-10

**The ask:** a full manual/formal test case matrix for the whole app —
TC ID, Title, Preconditions, Steps, Expected Result, blank Actual
Result — as a starting point for systematic automation, deliberately
*not* touching login/signup/verification while building it (that gate
had just cost real manual effort to get past — see Phase 12/13 — and
wasn't to be disturbed).

**Method.** Rather than write these from memory or guesswork, read the
actual Flutter source (`D:\My Projects\Audiobook-mobile\lib\`) —
validators, exact error/snackbar strings, API endpoints, conditionals,
state machines — screen by screen. Given the size (~9,500 lines across
20 screens + services), split the work across four parallel background
agents by feature area (Home/Library, Audiobooks/Player/Generation,
Voices/Recording, Profile/Vault) while personally reading the
auth/onboarding/verification screens directly, since that area already
had the most live-verified context from Phases 9–13.

**Result: 285 test cases**, delivered as `MemoryWave_Test_Cases.xlsx`
(one sheet per feature area + a Summary sheet), built from five source
TSVs (`docs/tc_*.tsv`) via `docs/build_tc_excel.py`. Notable findings
surfaced purely from reading code, not yet re-verified live:
- Registration auto-logs the user in and sends them to verification
  immediately, despite the snackbar saying "Please log in."
- Email validation everywhere is just `.contains('@')`, not a real
  format check.
- No retake/re-record option anywhere in the voice registration
  recording stage.
- Offline downloads, bookmarks, and sleep timer in the player are all
  toast-stub placeholders, not implemented.

**Held back explicitly** (59 of 285 cases): all of WEL-*, LGN-*, REG-*,
VER-*, plus PROF-030 (logout) and PROF-031–033 (account deletion) — per
the user's standing instruction not to touch signup/signin, and not to
disturb the now-manually-verified session.

**Then: executing the first real batch, live.** With the session
confirmed still logged in and verified (a live `dumpsys` check, not an
assumption), set `wdio.conf.ts`'s `appium:noReset` back to `true` — this
time for the right reason: keeping the *already-authenticated* session
alive across Appium sessions for every post-login suite, not (as the
failed Phase 13 attempt tried) hoping it would help get *past*
verification. Explored Home, Player, and Book Pages live via
`uiautomator dump` to ground the new `home.screen.ts` / `player.screen.ts`
/ `book-pages.screen.ts` page objects and a new `home.spec.ts` in real
selectors against the real account (2 audiobooks, 1 PDF, "Kazi").

**Two real bugs found and fixed while automating, not app bugs:**
1. **Ambiguous selector, not a false positive.** The PDF card and its
   own audiobook share the same filename prefix
   (`D_Strange-Girl_Meets_Boy_Penguin_Readers-1-min`), so a `starts-with`
   XPath matched the audiobook tile first and tapped that instead of the
   PDF. Fixed by requiring `contains(@content-desc,"pages")` to
   disambiguate — `home.screen.ts`'s `audiobookTile()` and `pdfTile()`
   are now mutually exclusive by construction.
2. **A genuine dead-zone tap bug, confirmed manually before blaming
   Appium.** Tapping the PDF card kept silently doing nothing — no
   error, no navigation. Reproduced with a raw `adb shell input tap` at
   the exact reported center coordinate before concluding this wasn't
   an automation quirk: the card's accessibility bounds span the full
   screen width, but the actual Flutter gesture detector only covers the
   leading icon+text area: the empty space to the right is a dead zone,
   and `element.click()` taps the bounds' center by default. Added
   `BaseMobileScreen.clickNearStart()` (taps near the left edge instead)
   as the general fix — likely relevant to other full-width list rows
   across the app (Library, Voices) once those get automated too.
- **Also found and fixed a leftover-state cascade**: with `noReset:true`,
  Appium attaches to whatever screen the app was last left on rather
  than relaunching fresh, so a prior test's failure (stuck on Player)
  cascaded into every later test in the same run. Fixed with a
  `beforeEach` in `home.spec.ts` that presses back (bounded retries)
  until Home is confirmed visible.

**Result:** `home.spec.ts` (6 tests: HOM-003, HOM-011, HOM-013, HOM-016,
plus cross-references AUD-034/LIB-023/LIB-024) passes reliably across
repeated runs, ~12s each. `MemoryWave_Test_Cases.xlsx`'s Actual Result
column updated to Pass for those seven TC IDs. Next: continue through
the remaining ~220 eligible cases, area by area.

---

## Phase 15 — Four more areas automated: Library, Voices, Profile, Vault

**Date:** 2026-09-10

Continued straight through Library, Voices, Profile, and Vault in one
session, live-exploring each screen via `uiautomator dump` before
writing any selector — same method as every prior phase, and it kept
paying off: several assumptions carried over from earlier exploration
turned out to be stale or simply wrong once checked against the actual
running screen.

**New suites, all passing reliably (20 tests total, run together):**
`library.spec.ts` (4), `voices.spec.ts` (4), `profile.spec.ts` (4),
`vault.spec.ts` (2), on top of the existing `home.spec.ts` (6). Voices
and Profile tests are deliberately non-mutating — every dialog opened
(Register, Lend consent, Upgrade) is explicitly cancelled/declined, never
confirmed, so no voice gets registered or lent and no plan gets changed
by the suite itself.

**Real findings and self-corrections along the way:**
- **A stale assumption from earlier manual exploration, corrected.** Assumed
  the Public shelf's default category was "Voice" (true earlier in the
  session, likely after an earlier manual tap) — a truly fresh visit
  actually defaults to "Audiobook". Found by checking live rather than
  trusting an old note, and `library.spec.ts` now explicitly selects the
  category it needs instead of assuming a default.
- **A second wrong assumption, also corrected before it shipped.** Assumed
  the Public shelf's PDF category would show the account's own uploaded
  PDF. It doesn't — Public/PDF is the store catalogue (sample titles like
  "The Hobbit"); the personal upload only appears under Your Library.
  Caught by actually reading what rendered instead of asserting on the
  filename I expected to see.
- **A real, more severe version of the Phase 14 dead-zone bug.** Pressing
  Android "back" enough times from a bottom-nav tab (Home included) exits
  the app to the launcher entirely, rather than stopping at Home — worse
  than just landing on the wrong screen, since a subsequent `am start`
  cold-starts the whole process. Confirmed this correctly re-resolves
  session/verification state (both persist locally) rather than working
  around it some other way. Replaced the old bounded-back-press loop with
  `HomeScreen.ensureDisplayed()`: at most 2 back presses, then relaunch the
  app itself as a guaranteed-safe fallback, reused by every new spec's
  `beforeEach`.
- **A scroll-dependent version of the same dead-zone family, on Profile.**
  "Private vault" is the last row in a Flutter-merged multi-row semantics
  block that sits below the fold on first load; tapping it without
  scrolling first (or scrolling only once, from a session's very first
  gesture — also observed to silently no-op once, live) misses entirely.
  Fixed by scrolling in a retry loop that checks for "Log out" (a marker
  only visible once fully scrolled) rather than assuming any fixed swipe
  count worked.
- **A process mistake, caught and corrected before it became silent data
  loss.** The very first Excel update landed only in a copy
  (`MemoryWave_Test_Cases_updated.xlsx`, made because the original was
  open in the user's Excel at the time) — and that copy was later deleted
  without merging its 7 Pass marks back into the original first. Caught
  by checking the total Pass count against what was expected before
  reporting completion; fixed by reapplying all 26 results to the
  original file directly once it was free to write to again.

**Result:** 26 of 285 test cases now marked Pass in
`MemoryWave_Test_Cases.xlsx`, all independently re-verified by rerunning
every non-auth spec together in one session with zero failures. ~200
eligible cases remain (mostly Audiobooks generation flow, Player detail,
and the remaining Voices recording/upload flow).

---

## Phase 16 — A real generation, end to end, on an existing voice and a paid title

**Date:** 2026-09-10

Directed to use only existing voices (no new recording) and to exercise
the account's paid-audiobook entitlement. Explored live: bought a
catalogue title ("Ten Minutes to Six", $4.49 — the same mock-payment
path as the Profile Upgrade dialog, confirmed no real charge), generated
a real narration from it using an existing voice ("Riad New"), and
watched it go from submission to `DONE`. One genuine surprise: the
in-app copy promises "10–15 minutes," but this short catalogue sample
finished in **under a second** in this environment — a real gap between
the UI's own estimate and observed behavior for short texts, not a test
artifact.

**Two more real bugs, caught before they shipped:**
- **A plain typo.** `AudiobookPlayerScreen.isFirstChapterButtonVisible()`
  called `this.chapterButton(1)` as if it were an instance method, but
  it was defined as a property on the module-level `SELECTORS` object —
  `this.chapterButton` didn't exist. Moved it to a standalone helper
  function instead of a `SELECTORS` entry, which also happens to make
  this exact mistake impossible to repeat (nothing named
  `SELECTORS.chapterButton` for `this.` to shadow).
- **The by-now-familiar instant-check timing bug**, this time in
  `AudiobooksScreen.isVoicePreselected()` and
  `AudiobookPlayerScreen.isSeekBarVisible()` — both used `isVisible()`
  (checks the current frame instantly) right after a navigation, instead
  of `waitVisible()`. Same fix as every previous occurrence of this
  pattern.
- **A more serious bug in the shared recovery helper itself,**
  `HomeScreen.ensureDisplayed()`, found because this suite's navigation
  pattern (Library → detail sheet → generation form → player, several
  levels deep) finally exercised it hard enough to break: `mobile:
  activateApp` only *foregrounds* an already-running process — confirmed
  live it resumed exactly on Library, not Home, when the app had never
  actually died. It had only looked like a working "cold start" fallback
  in earlier phases because those failures happened to follow a real
  process kill (the launcher-exit bug from Phase 15). Rewrote the method
  to (1) tap the HOME bottom-nav button directly first — Home/Today/
  Library/Voices are sibling tabs in an `IndexedStack`, not pushed
  routes, so "back" was never the right tool for switching between them
  to begin with — and only fall back to bounded "back" presses for
  popping an actually-pushed screen; (2) use `mobile: terminateApp` then
  `mobile: activateApp` together as the last resort, for a real cold
  restart rather than a mere foreground.

**Result:** `audiobooks.spec.ts` (3 tests: AUD-004/AUD-015, AUD-021,
AUD-034/AUD-036) passes reliably, confirmed alongside a full rerun of
all five prior suites (23 tests total across 6 spec files) with zero
failures — the `ensureDisplayed()` rewrite didn't regress anything that
depended on it. 30 of 285 test cases now marked Pass.
