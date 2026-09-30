import * as fs from 'fs';
import * as path from 'path';
// Relative imports: also runs standalone via ts-node (see bottom), where
// tsconfig path aliases aren't registered.
import { config } from '../config/env.config';
import { buildMinimalPdf } from './pdf-fixture';

// Recreates the mobile test account's ground-truth content through the
// same API calls the app itself makes (read from Audiobook-mobile's
// services/*.dart), so post-login specs have real data to assert on — and
// a backend reset is recovered by just re-running this. Idempotent: each
// step first looks for its fixture by name and only creates what's
// missing.
//
// The voice is enrolled from a committed SYNTHETIC clip (Windows TTS,
// fixtures/mobile/qa-synthetic-voice.wav — not any real person's voice)
// via capture option B (`extract_voice_only=true`, API_DOCUMENTATION.md
// §6), which skips liveness by design, exactly as the app's own upload
// path does.

const PIPELINE = 'v4'; // ApiConfig.pipelineVersion in the app
const VOICE_CLIP = path.resolve(__dirname, '../../fixtures/mobile/qa-synthetic-voice.wav');

export const MOBILE_FIXTURE = {
  pdfFilename: 'qa-fixture-book.pdf',
  voiceName: 'QA Voice',
  audiobookTitle: 'QA Fixture Audiobook',
};

const PDF_TEXT =
  'QA fixture book. The lighthouse keeper counted the ships each evening, ' +
  'writing their names in a small blue notebook beside the lamp.';
const AUDIOBOOK_TEXT =
  'The lighthouse keeper counted the ships each evening. He wrote their names ' +
  'in a small blue notebook, and when the fog came in, he read them aloud.';

type Json = Record<string, any>;

class OdiobukApi {
  private constructor(private readonly token: string) {}

  static async login(): Promise<OdiobukApi> {
    const { email, password } = config.mobile.testAccount;
    if (!email || !password) throw new Error('MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD must be set');
    const res = await fetch(`${config.odiobukApiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login for ${email} failed: HTTP ${res.status}`);
    const body = (await res.json()) as Json;
    return new OdiobukApi(body.tokens.access_token);
  }

  async request(method: string, route: string, body?: Json | FormData): Promise<Json> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${config.odiobukApiBaseUrl}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${route} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text ? (JSON.parse(text) as Json) : {};
  }

  /** Polls GET /api/jobs/{id} (API_DOCUMENTATION.md §3) until it settles. */
  async waitForJob(jobId: string, label: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await this.request('GET', `/api/jobs/${jobId}`);
      if (job.status === 'done') return;
      if (job.status === 'error' || job.status === 'cancelled') {
        throw new Error(`${label} job ${jobId} ended as ${job.status}: ${JSON.stringify(job).slice(0, 300)}`);
      }
      await sleep(10000);
    }
    throw new Error(`${label} job ${jobId} did not finish within ${timeoutMs / 60000} min`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(`[mobile-account-seed] ${msg}`);
}

async function ensurePdf(api: OdiobukApi) {
  const { documents } = await api.request('GET', '/api/documents');
  if ((documents as Json[]).some((d) => d.filename === MOBILE_FIXTURE.pdfFilename)) {
    log(`PDF "${MOBILE_FIXTURE.pdfFilename}" already present`);
    return;
  }
  const form = new FormData();
  const pdf = await buildMinimalPdf(PDF_TEXT);
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), MOBILE_FIXTURE.pdfFilename);
  try {
    await api.request('POST', '/api/documents', form);
    log(`PDF "${MOBILE_FIXTURE.pdfFilename}" uploaded`);
  } catch (err) {
    // Since the 2026-09-24 backend replacement, own-PDF upload is disabled
    // server-side (403 "Uploading your own book is no longer available…")
    // even though the app still shows "Add a PDF". Not fatal: the voice and
    // audiobook fixtures don't depend on it.
    if (!String(err).includes('HTTP 403')) throw err;
    log(`WARNING: PDF upload refused by the backend — ${String(err).split('→')[1]?.trim()}`);
  }
}

/** Returns the ready persona id for MOBILE_FIXTURE.voiceName. */
async function ensureVoice(api: OdiobukApi): Promise<string> {
  const findPersona = async () =>
    ((await api.request('GET', '/api/voices/mine')).voices as Json[]).find(
      (v) => v.name === MOBILE_FIXTURE.voiceName
    );

  let persona = await findPersona();
  if (!persona) {
    log('Enrolling synthetic voice (capture upload, extract_voice_only)…');
    const created = await api.request('POST', `/api/${PIPELINE}/capture/sessions`, {
      name: MOBILE_FIXTURE.voiceName,
      protocol_variant: 'short',
    });
    const sessionId: string = created.session.id;

    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(VOICE_CLIP)], { type: 'audio/wav' }), path.basename(VOICE_CLIP));
    form.append('name', MOBILE_FIXTURE.voiceName);
    form.append('extract_voice_only', 'true');
    const upload = await api.request('POST', `/api/${PIPELINE}/capture/sessions/${sessionId}/video`, form);
    await api.waitForJob(upload.job_id, 'capture', 20 * 60000);

    const detail = await api.request('GET', `/api/${PIPELINE}/capture/sessions/${sessionId}`);
    if (detail.clone_ready !== true) {
      throw new Error(`Capture session ${sessionId} finished but is not clone_ready: ${JSON.stringify(detail).slice(0, 300)}`);
    }
    await api.request('POST', '/api/voices/mine', { session_id: sessionId, name: MOBILE_FIXTURE.voiceName, traits: [] });
    log(`Voice "${MOBILE_FIXTURE.voiceName}" registered`);
    persona = await findPersona();
  }

  // Registration is asynchronous server-side ("ready in a few minutes").
  const deadline = Date.now() + 20 * 60000;
  while (persona && persona.status !== 'ready') {
    if (persona.status === 'failed') throw new Error(`Voice "${MOBILE_FIXTURE.voiceName}" registration failed`);
    if (Date.now() > deadline) throw new Error(`Voice "${MOBILE_FIXTURE.voiceName}" still ${persona.status} after 20 min`);
    await sleep(15000);
    persona = await findPersona();
  }
  if (!persona) throw new Error(`Voice "${MOBILE_FIXTURE.voiceName}" missing after registration`);
  log(`Voice "${MOBILE_FIXTURE.voiceName}" is ready`);
  return persona.id as string;
}

async function ensureAudiobook(api: OdiobukApi, personaId: string) {
  const { audiobooks } = await api.request('GET', `/api/${PIPELINE}/audiobooks`);
  const existing = (audiobooks as Json[]).find((b) => b.title === MOBILE_FIXTURE.audiobookTitle);
  if (existing?.status === 'done') {
    log(`Audiobook "${MOBILE_FIXTURE.audiobookTitle}" already present`);
    return;
  }
  const book =
    existing ??
    (await api.request('POST', `/api/${PIPELINE}/audiobooks`, {
      persona_id: personaId,
      title: MOBILE_FIXTURE.audiobookTitle,
      text: AUDIOBOOK_TEXT,
      voice_style: null,
      model: 'voxcpm',
      auto_emotion: true,
    }));
  log(`Waiting for audiobook "${MOBILE_FIXTURE.audiobookTitle}" to generate…`);
  await api.waitForJob(book.job_id, 'audiobook', 30 * 60000);
  log(`Audiobook "${MOBILE_FIXTURE.audiobookTitle}" is done`);
}

export async function seedMobileAccount() {
  const api = await OdiobukApi.login();
  await ensurePdf(api);
  const personaId = await ensureVoice(api);
  await ensureAudiobook(api, personaId);
}

// Standalone: npx ts-node --transpile-only src/utils/mobile-account-seed.ts
if (require.main === module) {
  seedMobileAccount().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
