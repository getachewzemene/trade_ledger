export const SESSION_STORAGE_KEY = 'ledger-and-wick-session-v1';

function resolveStorage(storage) {
  if (storage && typeof storage === 'object') {
    return storage;
  }

  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }

  return null;
}

export function getProfileStorageKey(username) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername) {
    return null;
  }

  return `ledger-and-wick-profile-${cleanUsername}`;
}

export function createSessionState({ username, displayName, role = 'trader', loggedInAt = new Date().toISOString() } = {}) {
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(displayName || cleanUsername || 'Trader').trim();

  if (!cleanUsername) {
    return null;
  }

  return {
    username: cleanUsername.toLowerCase(),
    displayName: cleanDisplayName,
    role: String(role || 'trader').trim().toLowerCase(),
    loggedInAt
  };
}

export function isSessionActive(session) {
  return !!session && typeof session.username === 'string' && session.username.length > 0;
}

export function saveSessionState(storage, session) {
  const target = resolveStorage(storage);
  const safeSession = isSessionActive(session) ? session : null;

  if (!target) {
    return safeSession;
  }

  if (!safeSession) {
    try {
      delete target[SESSION_STORAGE_KEY];
    } catch (err) {
      // Ignore storage deletion failures in restricted environments.
    }
    return null;
  }

  target[SESSION_STORAGE_KEY] = JSON.stringify(safeSession);
  return safeSession;
}

export function loadSessionState(storage) {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }

  try {
    const raw = target[SESSION_STORAGE_KEY];
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return isSessionActive(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

export function clearSessionState(storage) {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }

  try {
    delete target[SESSION_STORAGE_KEY];
  } catch (err) {
    // Ignore storage removal failures in restricted environments.
  }

  return true;
}

export function saveProfileData(storage, username, profileData) {
  const target = resolveStorage(storage);
  const key = getProfileStorageKey(username);
  const safeProfile = profileData && typeof profileData === 'object' ? profileData : null;

  if (!target || !key || !safeProfile) {
    return null;
  }

  target[key] = JSON.stringify(safeProfile);
  return safeProfile;
}

export function loadProfileData(storage, username) {
  const target = resolveStorage(storage);
  const key = getProfileStorageKey(username);

  if (!target || !key) {
    return null;
  }

  try {
    const raw = target[key];
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

export function clearProfileData(storage, username) {
  const target = resolveStorage(storage);
  const key = getProfileStorageKey(username);

  if (!target || !key) {
    return null;
  }

  try {
    delete target[key];
  } catch (err) {
    // Ignore storage removal failures in restricted environments.
  }

  return true;
}
