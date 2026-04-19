import Account from '../models/account.model.js';
import botManager from '../services/botManager.service.js';
import logger from '../utils/logger.js';

export const startSession = async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, owner: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    await botManager.startSession(account, req.io);
    logger.info(`Session start requested: ${account.username}`);
    res.json({ message: 'Session starting', accountId: account._id });
  } catch (err) {
    logger.error(`startSession error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

export const stopSession = async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, owner: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    await botManager.stopSession(account._id.toString(), req.io);
    logger.info(`Session stopped: ${account.username}`);
    res.json({ message: 'Session stopped' });
  } catch (err) {
    logger.error(`stopSession error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

export const startAll = async (req, res) => {
  try {
    const accounts = await Account.find({ owner: req.user._id });
    const results = await Promise.allSettled(
      accounts.map((a) => botManager.startSession(a, req.io))
    );
    const summary = results.map((r, i) => ({
      username: accounts[i].username,
      status: r.status,
      reason: r.reason?.message,
    }));
    logger.info(`Bulk start initiated for ${accounts.length} accounts`);
    res.json({ summary });
  } catch (err) {
    logger.error(`startAll error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

export const stopAll = async (req, res) => {
  try {
    const accounts = await Account.find({ owner: req.user._id });
    await Promise.allSettled(
      accounts.map((a) => botManager.stopSession(a._id.toString(), req.io))
    );
    logger.info('Bulk stop completed');
    res.json({ message: 'All sessions stopped' });
  } catch (err) {
    logger.error(`stopAll error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

export const getActiveSessions = async (req, res) => {
  const active = botManager.getActiveSessions();
  res.json({ active });
};
