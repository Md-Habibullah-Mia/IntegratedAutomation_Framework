import { test, expect } from '@playwright/test';
import { ApiClient } from '@core/api-client';

test.describe('API - Health', () => {
  test('HEALTH-001 - liveness probe reports 200', async ({ request }) => {
    const client = new ApiClient(request);
    const res = await client.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toBeTruthy();
  });
});
