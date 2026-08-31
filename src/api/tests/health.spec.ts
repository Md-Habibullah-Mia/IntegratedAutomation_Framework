import { test, expect } from '@playwright/test';
import { ApiClient } from '@core/api-client';

test.describe('API - Health & Users', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const client = new ApiClient(request);
    const res = await client.get('/health');
    expect(res.status()).toBe(200);
  });

  test('GET /users returns a list', async ({ request }) => {
    const client = new ApiClient(request);
    const res = await client.get('/users');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /users creates a user', async ({ request }) => {
    const client = new ApiClient(request);
    const res = await client.post('/users', { name: 'QA Bot', email: 'qa.bot@example.com' });
    expect([200, 201]).toContain(res.status());
  });
});
