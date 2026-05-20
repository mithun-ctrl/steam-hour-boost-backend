import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import connectDB from './utils/db.js';
import logger from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import sessionRoutes from './routes/session.routes.js';
import gamesRoutes from './routes/games.routes.js';
import { initSocketService } from './services/socket.service.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const allowedOriginsUrl = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOriginsUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

connectDB();
app.use(cors({
  origin: allowedOriginsUrl,
  credentials: true,
}));
app.use(express.json());

// Attach io to every request so controllers can emit events
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/games', gamesRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Socket.io setup
initSocketService(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`Health check server is running on port ${PORT}`);
});

export { io };
