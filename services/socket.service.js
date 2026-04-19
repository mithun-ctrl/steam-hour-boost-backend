import logger from '../utils/logger.js';

export const initSocketService = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    socket.on('ping', () => socket.emit('pong'));
  });
};
