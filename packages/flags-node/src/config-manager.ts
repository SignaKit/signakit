/**
 * Config Manager
 *
 * Handles fetching and caching the config JSON from CloudFront/S3.
 */

import { SIGNAKIT_CDN_URL } from './constants'
import type { ProjectConfig, Environment } from './types'

export interface ConfigManagerOptions {
  orgId: string
  projectId: string
  environment: Environment
}

export class ConfigManager {
  private config: ProjectConfig | null = null
  private etag: string | null = null
  private orgId: string
  private projectId: string
  private environment: Environment

  constructor(options: ConfigManagerOptions) {
    this.orgId = options.orgId
    this.projectId = options.projectId
    this.environment = options.environment
  }

  /**
   * Get the URL for the latest config.
   */
  private getConfigUrl(): string {
    const baseUrl = SIGNAKIT_CDN_URL.replace(/\/$/, '') // Remove trailing slash
    return `${baseUrl}/configs/${this.orgId}/${this.projectId}/${this.environment}/latest.json`
  }

  /**
   * Fetch the config from CloudFront.
   * Uses ETag for conditional requests to avoid unnecessary data transfer.
   *
   * @returns The config
   * @throws Error if the fetch fails or CDN URL is not configured
   */
  async fetchConfig(): Promise<ProjectConfig> {
    const url = this.getConfigUrl()

    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    // Add If-None-Match header if we have an ETag
    if (this.etag) {
      headers['If-None-Match'] = this.etag
    }

    const response = await fetch(url, { headers })

    // 304 Not Modified - return cached config
    if (response.status === 304 && this.config) {
      return this.config
    }

    // Check for errors
    if (!response.ok) {
      throw new Error(`[SignaKit] Failed to fetch config: ${response.status} ${response.statusText}`)
    }

    // Store the new ETag
    const newEtag = response.headers.get('etag')
    if (newEtag) {
      this.etag = newEtag
    }

    // Parse and store the config
    const config = (await response.json()) as ProjectConfig
    this.config = config

    return config
  }

  /**
   * Get the current cached config.
   *
   * @returns The cached config or null if not yet fetched
   */
  getConfig(): ProjectConfig | null {
    return this.config
  }
}

/**
 * Parse an SDK key to extract org ID, project ID, and environment.
 *
 * SDK key format: sk_{env}_{orgId}_{projectId}_{random}
 * - env: 'dev' or 'prod'
 * - orgId: alphanumeric organization ID (Better Auth nanoid)
 * - projectId: numeric project ID
 * - random: random suffix
 *
 * @param sdkKey - The SDK key to parse
 * @returns Object with orgId, projectId and environment
 * @throws Error if the SDK key format is invalid
 */
export function parseSdkKey(sdkKey: string): { orgId: string; projectId: string; environment: Environment } {
  const parts = sdkKey.split('_')

  if (parts.length < 5 || parts[0] !== 'sk') {
    throw new Error(
      `[SignaKit] Invalid SDK key format. Expected: sk_{env}_{orgId}_{projectId}_{random}, got: ${sdkKey}`
    )
  }

  const envShort = parts[1]
  const orgId = parts[2]
  const projectId = parts[3]

  if (!envShort || !orgId || !projectId) {
    throw new Error(`[SignaKit] Invalid SDK key format. Could not extract environment, orgId, or projectId.`)
  }

  let environment: Environment
  if (envShort === 'dev') {
    environment = 'development'
  } else if (envShort === 'prod') {
    environment = 'production'
  } else {
    throw new Error(
      `[SignaKit] Invalid SDK key environment. Expected 'dev' or 'prod', got: ${envShort}`
    )
  }

  return { orgId, projectId, environment }
}
