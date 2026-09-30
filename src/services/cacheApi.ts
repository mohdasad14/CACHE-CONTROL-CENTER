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
// In AI Studio / local preview, defaults to /api (served by server.ts), or http://localhost:8080 when running against external Spring Boot
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = rawBaseUrl && rawBaseUrl.trim() !== '' ? rawBaseUrl.trim().replace(/\/+$/, '') : '/api';

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
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const startTime = performance.now();
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
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
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Unable to connect to cache backend at ${this.baseUrl}. Make sure the Spring Boot server is running on port 8080.`);
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
      // First try status endpoint, fallback to metrics
      await this.request<any>('/cache/metrics');
      const latencyMs = Math.round(performance.now() - startTime);
      return { online: true, latencyMs, url: this.baseUrl, version: 'Java 17 / Spring Boot 3' };
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
