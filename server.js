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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL // your Vercel URL e.g. https://your-app.vercel.app
].filter(Boolean); // removes undefined if FRONTEND_URL not set

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Session timeout middleware 
app.use((req, res, next) => {
  if (req.session.userId) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    
    // 30 minutes timeout
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
    
    // Update last activity time
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
app.get('/', (req, res) => {
  res.json({
    message: 'TaskFlow Backend API is running 🚀'
  });
});

// Database connection
// MONGODB_URI must be set in Railway env vars (MongoDB Atlas connection string)
// Never use localhost here — it won't work on Railway
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`✅ Health check: /api/health`);
      console.log(`✅ Test route: /api/test`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
// Handle graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
