import winston from 'winston';
import axios from 'axios';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Discord webhook integration
const sendToDiscord = async (level, message) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colors = { error: 0xff0000, warn: 0xffa500, info: 0x00ff00 };
  try {
    await axios.post(webhookUrl, {
      embeds: [{
        title: `Steam Dashboard — ${level.toUpperCase()}`,
        description: message,
        color: colors[level] || 0xffffff,
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (_err) {
    // Silently fail to avoid recursive logging
  }
};

// Wrap logger to optionally send errors to Discord
const originalError = logger.error.bind(logger);
logger.error = (msg, ...args) => {
  originalError(msg, ...args);
  sendToDiscord('error', msg);
};

export { sendToDiscord };
export default logger;
