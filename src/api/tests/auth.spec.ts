import { test, expect, APIRequestContext } from '@playwright/test';
import { ApiClient } from '@core/api-client';

// A password meeting the registration policy — AUTH-001's own example hints
// at "12+ chars"; this is well clear of that with mixed case, digit, symbol.
const STRONG_PASSWORD = 'Str0ngP@ssword2026!';

function freshEmail(): string {
  return `qa_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.com`;
}

async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string = STRONG_PASSWORD
) {
  const client = new ApiClient(request);
  return client.post('/api/auth/register', { email, password });
}

// Register returns { user, tokens: { access_token, refresh_token, token_type } }.
async function registerAndGetTokens(request: APIRequestContext, email: string) {
  const res = await registerUser(request, email);
  const body = await res.json();
  return {
    accessToken: body.tokens.access_token as string,
    refreshToken: body.tokens.refresh_token as string,
  };
}

test.describe('API - Auth', () => {
  test('AUTH-001 - Register a new account', async ({ request }) => {
    const res = await registerUser(request, freshEmail());
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.tokens.access_token).toBeTruthy();
    expect(body.tokens.refresh_token).toBeTruthy();
    expect(body.user.plan).toBe('free');
  });

  test('AUTH-002 - Register with an email already in use', async ({ request }) => {
    const email = freshEmail();
    const first = await registerUser(request, email);
    expect(first.status()).toBe(201);

    const second = await registerUser(request, email);
    expect(second.status()).toBe(409);
  });

  test('AUTH-003 - Register with a weak password', async ({ request }) => {
    const res = await registerUser(request, freshEmail(), 'abc');
    expect(res.status()).toBe(422);
  });

  test('AUTH-004 - Log in with correct credentials', async ({ request }) => {
    const email = freshEmail();
    const registered = await registerUser(request, email);
    expect(registered.status()).toBe(201);

    const client = new ApiClient(request);
    const res = await client.post('/api/auth/login', {
      email,
      password: STRONG_PASSWORD,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.tokens.access_token).toBeTruthy();
    expect(body.tokens.refresh_token).toBeTruthy();
  });

  test('AUTH-005 - Log in with a wrong password', async ({ request }) => {
    const email = freshEmail();
    const registered = await registerUser(request, email);
    expect(registered.status()).toBe(201);

    const client = new ApiClient(request);
    const res = await client.post('/api/auth/login', {
      email,
      password: 'TotallyWrongPassword123!',
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-007 - Read the current profile', async ({ request }) => {
    const email = freshEmail();
    const { accessToken } = await registerAndGetTokens(request, email);

    const client = new ApiClient(request, accessToken);
    const res = await client.get('/api/auth/me');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.email).toBe(email);
    expect(body).toHaveProperty('role');
    expect(body).toHaveProperty('id');
  });

  test('AUTH-008 - Call a protected route with no token', async ({ request }) => {
    const client = new ApiClient(request);
    const res = await client.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

  test('AUTH-009 - Call a protected route with a malformed token', async ({ request }) => {
    const client = new ApiClient(request, 'not-a-token');
    const res = await client.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

  test('AUTH-010 - Refresh the token pair', async ({ request }) => {
    const email = freshEmail();
    const { refreshToken } = await registerAndGetTokens(request, email);

    const client = new ApiClient(request);
    const res = await client.post('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
  });

  test('AUTH-011 - Refresh using an access token instead', async ({ request }) => {
    const email = freshEmail();
    const { accessToken } = await registerAndGetTokens(request, email);

    const client = new ApiClient(request);
    const res = await client.post('/api/auth/refresh', {
      refresh_token: accessToken,
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-012 - Logout revokes every existing token', async ({ request }) => {
    const email = freshEmail();
    const { accessToken, refreshToken } = await registerAndGetTokens(request, email);

    const client = new ApiClient(request, accessToken);
    const logoutRes = await client.post('/api/auth/logout', {});
    expect(logoutRes.status()).toBe(200);

    const meRes = await client.get('/api/auth/me');
    expect(meRes.status()).toBe(401);

    const refreshClient = new ApiClient(request);
    const refreshRes = await refreshClient.post('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    expect(refreshRes.status()).toBe(401);
  });
});
