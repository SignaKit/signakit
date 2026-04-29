import type { ProjectConfig, ConfigFlag } from '../../types'

// A/B test flag: premium users enter the experiment rule (100% traffic),
// free users fall through to default allocation.
const checkoutFlag: ConfigFlag = {
  id: 'flag_checkout',
  key: 'new-checkout-flow',
  status: 'active',
  running: true,
  salt: 'checkout-salt',
  variations: [
    { key: 'off' },
    { key: 'control' },
    { key: 'treatment', variables: { showBadge: true } },
  ],
  variables: [{ key: 'showBadge', type: 'boolean', defaultValue: false }],
  // Default: 50% off, 50% control (free users never see treatment)
  allocation: {
    ranges: [
      { variation: 'off', start: 0, end: 4999 },
      { variation: 'control', start: 5000, end: 9999 },
    ],
  },
  rules: [
    {
      ruleKey: 'rule-premium-ab',
      ruleType: 'ab-test',
      audienceMatchType: 'any',
      audiences: [{ conditions: [{ attribute: 'plan', operator: 'equals', value: 'premium' }] }],
      trafficPercentage: 100, // all premium users enter the experiment
      variationAllocation: {
        ranges: [
          { variation: 'control', start: 0, end: 4999 },
          { variation: 'treatment', start: 5000, end: 9999 },
        ],
      },
    },
  ],
}

// Targeted rollout: 100% of all users get 'on' (simple feature flag, no experiment).
const darkModeFlag: ConfigFlag = {
  id: 'flag_dark_mode',
  key: 'dark-mode',
  status: 'active',
  running: true,
  salt: 'dark-mode-salt',
  variations: [{ key: 'off' }, { key: 'on' }],
  allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
  rules: [
    {
      ruleKey: 'rule-full-rollout',
      ruleType: 'targeted',
      trafficPercentage: 100,
      variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
    },
  ],
}

// Allowlist flag: only explicitly listed users get 'on'; random traffic is 0%.
const allowlistFlag: ConfigFlag = {
  id: 'flag_allowlist',
  key: 'allowlist-feature',
  status: 'active',
  running: true,
  salt: 'allowlist-salt',
  variations: [{ key: 'off' }, { key: 'on' }],
  allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
  rules: [
    {
      ruleKey: 'rule-allowlist',
      ruleType: 'targeted',
      trafficPercentage: 0, // no random traffic — only allowlist entries matter
      variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
      allowlist: [
        { userId: 'qa-user-1', variation: 'on' },
        { userId: 'qa-user-2', variation: 'off' },
      ],
    },
  ],
}

// Flag with variables: tests variable resolution (defaults + variation overrides).
const variablesFlag: ConfigFlag = {
  id: 'flag_vars',
  key: 'feature-with-vars',
  status: 'active',
  running: true,
  salt: 'vars-salt',
  variations: [
    { key: 'off' },
    { key: 'v1' }, // uses all defaults
    { key: 'v2', variables: { color: 'blue', count: 5 } }, // overrides color and count
  ],
  variables: [
    { key: 'color', type: 'string', defaultValue: 'red' },
    { key: 'count', type: 'number', defaultValue: 1 },
    { key: 'enabled', type: 'boolean', defaultValue: true },
  ],
  // All users get v2 so we can reliably test variable overrides
  allocation: { ranges: [{ variation: 'v2', start: 0, end: 9999 }] },
}

// Disabled flag: running=false, should always return variationKey='off'.
const disabledFlag: ConfigFlag = {
  id: 'flag_disabled',
  key: 'disabled-flag',
  status: 'active',
  running: false,
  salt: 'disabled-salt',
  variations: [{ key: 'off' }, { key: 'on' }],
  allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
}

// Archived flag: status=archived, should be excluded from all results.
const archivedFlag: ConfigFlag = {
  id: 'flag_archived',
  key: 'archived-flag',
  status: 'archived',
  running: true,
  salt: 'archived-salt',
  variations: [{ key: 'off' }, { key: 'on' }],
  allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
}

export const mockConfig: ProjectConfig = {
  projectId: 'proj123',
  environmentKey: 'development',
  sdkKey: 'sk_dev_org123_proj123_abc123',
  version: 1,
  generatedAt: '2024-01-01T00:00:00.000Z',
  flags: [checkoutFlag, darkModeFlag, allowlistFlag, variablesFlag, disabledFlag, archivedFlag],
}

// A valid SDK key matching mockConfig's org/project/env
export const MOCK_SDK_KEY = 'sk_dev_org123_proj123_abc123'
