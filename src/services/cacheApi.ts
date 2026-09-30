/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CacheMetrics,
  CacheEntryItem,
  GetEntryResponse,
  PutEntryRequest,
  DemoResponse,
  EvictionPolicyType,
  BackendStatus,
} from '../types/cache';

// Base API URL configurable via environment variable VITE_API_BASE_URL
// If VITE_API_BASE_URL is invalid (e.g. random number/string) or unset, default to /api (served by server.ts)
function resolveInitialBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw || typeof raw !== 'string') return '/api';
  const trimmed = raw.trim();
  // Must be an absolute http(s) URL or relative path starting with /
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    return '/api';
  }
  return trimmed.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveInitialBaseUrl();

class CacheApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async setCapacity(capacity: number): Promise<{ success: boolean; capacity: number }> {
    return this.request<{ success: boolean; capacity: number }>('/cache/capacity', {
      method: 'POST',
      body: JSON.stringify({ capacity }),
    });
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = `${this.baseUrl}${cleanEndpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(primaryUrl, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // If external 404/500 occurred and we're not on /api, try fallback to /api
        if (this.baseUrl !== '/api') {
          console.warn(`External cache backend at ${this.baseUrl} returned ${response.status}. Falling back to /api runtime.`);
          this.baseUrl = '/api';
          return this.request<T>(endpoint, options);
        }

        let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody && (errBody.message || errBody.error)) {
            errorMsg = errBody.message || errBody.error;
          }
        } catch {
          // ignore non-json error body
        }
        throw new Error(errorMsg);
      }

      // Check if response has content
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (err: any) {
      // If fetching external URL failed (e.g. Connection refused on 8080), seamlessly fallback to /api
      if (this.baseUrl !== '/api') {
        console.warn(`Could not reach external cache backend at ${this.baseUrl}. Falling back to internal Java-spec /api runtime.`);
        this.baseUrl = '/api';
        return this.request<T>(endpoint, options);
      }
      throw err;
    }
  }

  /**
   * Health status probe
   */
  public async getStatus(): Promise<BackendStatus> {
    const startTime = performance.now();
    try {
      await this.request<any>('/cache/metrics');
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
      const isExternal = this.baseUrl.startsWith('http');
      return {
        online: true,
        latencyMs,
        url: this.baseUrl,
        version: isExternal ? 'Java 17 / Spring Boot 3 (Port 8080)' : 'Java 17 Spec Runtime (/api)',
      };
    } catch {
      return { online: false, url: this.baseUrl };
    }
  }

  /**
   * GET /api/cache/metrics
   */
  public async getMetrics(): Promise<CacheMetrics> {
    return this.request<CacheMetrics>('/cache/metrics');
  }

  /**
   * GET /api/cache
   */
  public async getEntries(): Promise<CacheEntryItem[]> {
    return this.request<CacheEntryItem[]>('/cache');
  }

  /**
   * GET /api/cache/{key}
   */
  public async getEntry(key: string): Promise<GetEntryResponse> {
    return this.request<GetEntryResponse>(`/cache/${encodeURIComponent(key)}`);
  }

  /**
   * PUT /api/cache/{key}
   */
  public async putEntry(key: string, value: string, ttlMillis: number = 0): Promise<{ success: boolean; message?: string }> {
    const body: PutEntryRequest = { value, ttlMillis };
    return this.request<{ success: boolean; message?: string }>(`/cache/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE /api/cache/{key}
   */
  public async deleteEntry(key: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/cache/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  /**
   * DELETE /api/cache
   */
  public async clearCache(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/cache', {
      method: 'DELETE',
    });
  }

  /**
   * POST /api/cache/policy
   */
  public async setPolicy(policy: EvictionPolicyType): Promise<{ success: boolean; policy: EvictionPolicyType }> {
    return this.request<{ success: boolean; policy: EvictionPolicyType }>('/cache/policy', {
      method: 'POST',
      body: JSON.stringify({ policy }),
    });
  }

  /**
   * POST /api/cache/metrics/reset
   */
  public async resetMetrics(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/cache/metrics/reset', {
      method: 'POST',
    });
  }

  /**
   * POST /api/cache/demo
   */
  public async runDemo(policy?: EvictionPolicyType): Promise<DemoResponse> {
    return this.request<DemoResponse>('/cache/demo', {
      method: 'POST',
      body: JSON.stringify(policy ? { policy } : {}),
    });
  }
}

export const cacheApi = new CacheApiService();
