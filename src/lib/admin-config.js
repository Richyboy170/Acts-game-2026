import { constantTimeEqual } from './admin-auth.js';

export function getAdminUsernames(env = process.env) {
  const configured = env.ADMIN_USERNAMES || env.ADMIN_USERNAME || '';
  return [...new Set(configured.split(',').map((username) => username.trim()).filter(Boolean))];
}

export function isAdminLoginConfigured(env = process.env) {
  return getAdminUsernames(env).length > 0
    && Boolean(env.ADMIN_PASSWORD)
    && typeof env.ADMIN_SESSION_SECRET === 'string'
    && env.ADMIN_SESSION_SECRET.length >= 32;
}

export function verifyAdminCredentials(username, password, env = process.env) {
  const configuredUsernames = getAdminUsernames(env);
  let usernameMatches = false;
  for (const configuredUsername of configuredUsernames) {
    usernameMatches = constantTimeEqual(username, configuredUsername) || usernameMatches;
  }
  const passwordMatches = constantTimeEqual(password, env.ADMIN_PASSWORD);
  return configuredUsernames.length > 0 && usernameMatches && passwordMatches;
}
