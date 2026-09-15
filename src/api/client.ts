import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ServiceId } from './types';

export interface LoginBody {
  device: string;
  serial: string;
  push_token?: string;
}

/**
 * Thin typed wrapper around every endpoint of the Free API. Methods return the raw
 * `APIResponse` (never throw on non-2xx) so tests can assert on status, headers and
 * body for both happy paths and documented error cases (403/404/422/429).
 */
export class FreeApiClient {
  constructor(private readonly request: APIRequestContext) {}

  login(body: LoginBody): Promise<APIResponse> {
    return this.request.post('login', { data: body });
  }

  /** Like `login`, but accepts any payload shape — for negative tests of the 422 validation path. */
  loginRaw(body: Record<string, unknown>): Promise<APIResponse> {
    return this.request.post('login', { data: body });
  }

  getServices(): Promise<APIResponse> {
    return this.request.get('services');
  }

  getSettings(): Promise<APIResponse> {
    return this.request.get('settings');
  }

  getPage(slug: string): Promise<APIResponse> {
    return this.request.get(`pages/${encodeURIComponent(slug)}`);
  }

  getRadioPage(): Promise<APIResponse> {
    return this.request.get('pages/radio');
  }

  getPageBlock(slug: string, id: string): Promise<APIResponse> {
    return this.request.get(`pages/${encodeURIComponent(slug)}/blocks/${encodeURIComponent(id)}`);
  }

  getRadioChannelGroupBlock(): Promise<APIResponse> {
    return this.request.get('pages/radio/channel-group');
  }

  getContentDetails(service: ServiceId | string, id: string): Promise<APIResponse> {
    return this.request.get(`content/${encodeURIComponent(service)}/${encodeURIComponent(id)}`);
  }

  playFreeContent(service: ServiceId | string, id: string): Promise<APIResponse> {
    return this.request.get(`content/${encodeURIComponent(service)}/free/${encodeURIComponent(id)}/play`);
  }

  playRadioChannel(channel: string): Promise<APIResponse> {
    return this.request.get(`channels/${encodeURIComponent(channel)}/play`);
  }
}
