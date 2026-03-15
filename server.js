const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true on Railway (HTTPS), false locally
    httpOnly: true,
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.options("*",cors());

app.use(express.json());

// Session timeout middleware
app.use((req, res, next) => {
  if (req.session.userId) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;

    if (now - lastActivity > 30 * 60 * 1000) {
      req.session.destroy((err) => {
        if (err) {
          console.log('Session destruction error:', err);
        }

        return res.status(401).json({
          message: 'Session expired. Please login again.'
        });
      });

      return;
    }

    req.session.lastActivity = now;
  }

  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/todos', require('./routes/todos'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working with database!' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running with MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'TaskFlow Backend API is running 🚀'
  });
});

// PORT
const PORT = process.env.PORT || 5000;

// MongoDB connection

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully!');

    // Start server ONLY after DB connects
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`✅ Health check: /api/health`);
      console.log(`✅ Test route: /api/test`);
      console.log('🗄️ Using REAL MongoDB database - data will persist!');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});