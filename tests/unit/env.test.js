/**
 * Unit tests for configuration loading (src/config/env.js): the server must
 * refuse to start with missing or unsafe settings.
 */
const ORIGINAL_ENV = { ...process.env };

// Loads env.js fresh with the given variables. dotenv is mocked so a
// developer's local .env file can't fill in the values we're testing without.
function loadConfig(overrides) {
  process.env = { ...ORIGINAL_ENV, ...overrides };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }
  let config;
  jest.isolateModules(() => {
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    config = require('../../src/config/env');
  });
  return config;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('config/env', () => {
  it('reads settings and applies defaults', () => {
    const config = loadConfig({ PORT: undefined, JWT_EXPIRES_IN: undefined, CORS_ORIGIN: 'http://a.com, http://b.com' });

    expect(config.port).toBe(5000);
    expect(config.jwtExpiresIn).toBe('1d');
    expect(config.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
    expect(config.isTest).toBe(true);
  });

  it('refuses to start without required variables', () => {
    expect(() => loadConfig({ MONGODB_URI: undefined, JWT_SECRET: undefined })).toThrow(
      /Missing required environment variable\(s\): MONGODB_URI, JWT_SECRET/
    );
  });

  it('refuses a short JWT secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'too-short' })).toThrow(/at least 32 characters/);
  });
});
