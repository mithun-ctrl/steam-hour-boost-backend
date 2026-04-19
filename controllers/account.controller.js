import Account from '../models/account.model.js';
import { encrypt } from '../utils/encryption.js';
import logger from '../utils/logger.js';

export const getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(accounts.map((a) => a.toSafeJSON()));
  } catch (err) {
    logger.error(`getAccounts error: ${err.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { username, password, sharedSecret, gameIds, notes } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const account = await Account.create({
      owner: req.user._id,
      username,
      encryptedPassword: encrypt(password),
      encryptedSharedSecret: sharedSecret ? encrypt(sharedSecret) : null,
      gameIds: gameIds || [],
      notes: notes || '',
    });

    logger.info(`Account created: ${username}`);
    res.status(201).json(account.toSafeJSON());
  } catch (err) {
    logger.error(`createAccount error: ${err.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateAccount = async (req, res) => {
  try {
    const { username, password, sharedSecret, gameIds, notes } = req.body;
    const account = await Account.findOne({ _id: req.params.id, owner: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    if (username) account.username = username;
    if (password) account.encryptedPassword = encrypt(password);
    if (sharedSecret !== undefined)
      account.encryptedSharedSecret = sharedSecret ? encrypt(sharedSecret) : null;
    if (gameIds !== undefined) account.gameIds = gameIds;
    if (notes !== undefined) account.notes = notes;

    await account.save();
    logger.info(`Account updated: ${account.username}`);
    res.json(account.toSafeJSON());
  } catch (err) {
    logger.error(`updateAccount error: ${err.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    logger.info(`Account deleted: ${account.username}`);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    logger.error(`deleteAccount error: ${err.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};
