const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  // CHANGED: Theme preference as boolean (true = dark mode, false = light mode)
  darkMode: {
    type: Boolean,
    default: false  // Default to light mode
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: null
  },
  verificationCodeExpires: {
    type: Date,
    default: null
  },
  resetPasswordCode: {
    type: String,
    default: null
  },
  resetPasswordCodeExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// CHANGED: Update dark mode preference (true = dark, false = light)
UserSchema.methods.updateDarkMode = function(darkMode) {
  this.darkMode = darkMode;
  return this.save();
};

// Check if verification code is valid
UserSchema.methods.isVerificationCodeValid = function() {
  return this.verificationCode && 
         this.verificationCodeExpires && 
         this.verificationCodeExpires > Date.now();
};

// Check if reset code is valid
UserSchema.methods.isResetCodeValid = function() {
  return this.resetPasswordCode && 
         this.resetPasswordCodeExpires && 
         this.resetPasswordCodeExpires > Date.now();
};

module.exports = mongoose.model('User', UserSchema);