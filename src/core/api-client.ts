import { APIRequestContext, APIResponse } from '@playwright/test';
import { config } from '@config/env.config';
import { logger } from './logger';

/**
 * ApiClient
 * Thin wrapper so API tests don't repeat base URL / header / logging
 * boilerplate. Swap auth strategy here once, every test benefits.
 */
export class ApiClient {
  constructor(private request: APIRequestContext, private token?: string) {}

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async get(path: string, params?: Record<string, string>): Promise<APIResponse> {
    logger.info(`GET ${config.odiobukApiBaseUrl}${path}`);
    return this.request.get(`${config.odiobukApiBaseUrl}${path}`, {
      headers: this.headers(),
      params,
    });
  }

  async post(path: string, body: unknown): Promise<APIResponse> {
    logger.info(`POST ${config.odiobukApiBaseUrl}${path}`);
    return this.request.post(`${config.odiobukApiBaseUrl}${path}`, {
      headers: this.headers(),
      data: body,
    });
  }

  async patch(path: string, body: unknown): Promise<APIResponse> {
    logger.info(`PATCH ${config.odiobukApiBaseUrl}${path}`);
    return this.request.patch(`${config.odiobukApiBaseUrl}${path}`, {
      headers: this.headers(),
      data: body,
    });
  }

  async put(path: string, body: unknown): Promise<APIResponse> {
    return this.request.put(`${config.odiobukApiBaseUrl}${path}`, {
      headers: this.headers(),
      data: body,
    });
  }

  async delete(path: string): Promise<APIResponse> {
    return this.request.delete(`${config.odiobukApiBaseUrl}${path}`, {
      headers: this.headers(),
    });
  }
}
