import SteamUser from 'steam-user';
import SteamTotp from 'steam-totp';
import { LoginSession, EAuthTokenPlatformType } from 'steam-session';
import Account from '../models/account.model.js';
import { decrypt } from '../utils/encryption.js';
import logger from '../utils/logger.js';

// accountId (string) → { client: SteamUser, retryCount, retryTimer }
const sessions = new Map();

const MAX_RETRIES = 5;
const RETRY_DELAYS = [5000, 15000, 30000, 60000, 120000];

const emitStatus = (io, accountId, status, extra = {}) => {
  if (io) io.emit('account:status', { accountId, status, ...extra });
};

const updateAccountStatus = async (accountId, status, lastError = null) => {
  try {
    await Account.findByIdAndUpdate(accountId, { status, lastError });
  } catch (err) {
    logger.error(`Failed to persist status for ${accountId}: ${err.message}`);
  }
};

const startSession = async (account, io) => {
  const accountId = account._id.toString();

  // Already running
  if (sessions.has(accountId)) {
    logger.warn(`Session already active for ${account.username}`);
    return;
  }

  const password = decrypt(account.encryptedPassword);
  const sharedSecret = account.encryptedSharedSecret
    ? decrypt(account.encryptedSharedSecret)
    : null;

  const client = new SteamUser();

  sessions.set(accountId, { client, retryCount: 0, retryTimer: null });

  await updateAccountStatus(accountId, 'connecting');
  emitStatus(io, accountId, 'connecting');
  logger.info(`Connecting Steam account: ${account.username}`);

  const attachClientHandlers = () => {
    client.on('loggedOn', async () => {
      logger.info(`Steam account online: ${account.username}`);
      client.setPersona(SteamUser.EPersonaState.Online);

      if (account.gameIds && account.gameIds.length > 0) {
        client.gamesPlayed(account.gameIds);
        logger.info(`Games set for ${account.username}: [${account.gameIds.join(', ')}]`);
      }

      const sess = sessions.get(accountId);
      if (sess) sess.retryCount = 0;

      await updateAccountStatus(accountId, 'online');
      emitStatus(io, accountId, 'online', { gameIds: account.gameIds });
    });

    client.on('error', async (err) => {
      logger.error(`Steam error for ${account.username}: ${err.message}`);
      const sess = sessions.get(accountId);
      if (!sess || sess.intentionalStop) return;

      sessions.delete(accountId);

      await updateAccountStatus(accountId, 'error', err.message);
      emitStatus(io, accountId, 'error', { error: err.message });

      // Attempt reconnect with exponential back-off
      scheduleReconnect(account, io);
    });

    client.on('disconnected', async (eresult, msg) => {
      logger.warn(`Steam disconnected for ${account.username}: ${msg}`);
      const sess = sessions.get(accountId);
      if (!sess || sess.intentionalStop) return;

      sessions.delete(accountId);

      await updateAccountStatus(accountId, 'offline');
      emitStatus(io, accountId, 'offline');

      scheduleReconnect(account, io);
    });

    client.on('steamGuard', (domain, callback) => {
      if (sharedSecret) {
        const code = SteamTotp.generateAuthCode(sharedSecret);
        logger.info(`Steam Guard 2FA generated for ${account.username}`);
        callback(code);
      } else {
        logger.error(`Steam Guard required for ${account.username} but no shared secret set`);
        emitStatus(io, accountId, 'error', { error: 'Steam Guard required – add shared secret or approve on mobile' });
      }
    });
  };

  attachClientHandlers();

  if (!sharedSecret) {
    // If no shared secret, use steam-session to allow mobile confirmation polling
    try {
      const session = new LoginSession(EAuthTokenPlatformType.SteamClient);

      session.on('authenticated', async () => {
        logger.info(`Session authenticated via mobile confirmation for ${account.username}`);
        client.logOn({ refreshToken: session.refreshToken });
      });

      session.on('timeout', () => {
        logger.error(`Login session timeout for ${account.username}`);
        sessions.delete(accountId);
        updateAccountStatus(accountId, 'error', 'Login timeout (did you approve?)');
        emitStatus(io, accountId, 'error', { error: 'Login timeout (did you approve?)' });
      });

      session.on('error', (err) => {
        logger.error(`Login session error for ${account.username}: ${err.message}`);
        sessions.delete(accountId);
        updateAccountStatus(accountId, 'error', err.message);
        emitStatus(io, accountId, 'error', { error: err.message });
      });

      const startResult = await session.startWithCredentials({
        accountName: account.username,
        password: password,
      });

      if (startResult.actionRequired) {
        logger.info(`Waiting for mobile confirmation for ${account.username}`);
        emitStatus(io, accountId, 'connecting', { info: 'Please approve on Steam Mobile App' });
      }
    } catch (err) {
      logger.error(`Failed to start login session for ${account.username}: ${err.message}`);
      sessions.delete(accountId);
      updateAccountStatus(accountId, 'error', err.message);
      emitStatus(io, accountId, 'error', { error: err.message });
    }
  } else {
    // Standard login flow when shared secret is available
    const logOnOptions = { accountName: account.username, password };
    logOnOptions.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
    client.logOn(logOnOptions);
  }
};

const scheduleReconnect = (account, io) => {
  const accountId = account._id.toString();
  const existing = sessions.get(accountId);
  const retryCount = existing ? existing.retryCount : 0;

  if (retryCount >= MAX_RETRIES) {
    logger.warn(`Max retries reached for ${account.username}. Giving up.`);
    return;
  }

  const delay = RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
  logger.info(`Scheduling reconnect for ${account.username} in ${delay / 1000}s (attempt ${retryCount + 1})`);

  const retryTimer = setTimeout(async () => {
    const freshAccount = await Account.findById(accountId);
    if (!freshAccount) return;
    sessions.set(accountId, { client: null, retryCount: retryCount + 1, retryTimer: null });
    await startSession(freshAccount, io);
  }, delay);

  sessions.set(accountId, { client: existing?.client || null, retryCount, retryTimer });
};

const stopSession = async (accountId, io) => {
  const sess = sessions.get(accountId);
  if (!sess) return;

  if (sess.retryTimer) clearTimeout(sess.retryTimer);

  sess.intentionalStop = true;

  if (sess.client) {
    try {
      sess.client.gamesPlayed([]);
      sess.client.logOff();
    } catch (_) { /* already disconnected */ }
  }

  sessions.delete(accountId);
  await updateAccountStatus(accountId, 'offline');
  emitStatus(io, accountId, 'offline');
  logger.info(`Session stopped for account ${accountId}`);
};

const getActiveSessions = () => {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    accountId: id,
    connected: s.client?.steamID != null,
    retryCount: s.retryCount,
  }));
};

export default { startSession, stopSession, getActiveSessions, scheduleReconnect };
