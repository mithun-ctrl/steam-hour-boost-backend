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
import { initSocketService } from './services/socket.service.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://steam-hourboost-client.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://steam-hourboost-client.vercel.app',
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

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Socket.io setup
initSocketService(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export { io };
