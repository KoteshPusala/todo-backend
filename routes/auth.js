const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const generateCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const tempUsers = new Map();

router.post('/register', async (req, res) => {
  try {
    console.log('🔵 Registration request received:', req.body);
    
    const { username, email, password } = req.body;

    // Check if user already exists in DATABASE
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      console.log('🔴 User already exists:', existingUser);
      return res.status(400).json({ 
        error: 'User already exists with this email or username' 
      });
    }

    // Generate verification code
    const verificationCode = generateCode();
    console.log('🟡 Verification code generated:', verificationCode);

    // Store user data temporarily (NOT in database)
    const tempUserData = {
      username,
      email,
      password,
      verificationCode,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      createdAt: new Date()
    };

    // Store in memory
    tempUsers.set(email, tempUserData);
    console.log('🟡 Temporary user data stored (not in database):', email);

    console.log('🟡 Preparing to send verification email...');

    // 🔥 SEND RESPONSE FIRST (prevents frontend timeout)
    res.status(200).json({ 
      message: 'Verification code sent to your email. Please verify to complete registration.',
      email: email,
      requiresVerification: true
    });

    // 🔥 SEND EMAIL IN BACKGROUND
    sendVerificationEmail(email, verificationCode)
      .then(() => {
        console.log('🟢 Verification email sent successfully');
      })
      .catch((error) => {
        console.error('🔴 Email sending error:', error);
      });

  } catch (error) {
    console.error('🔴 Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!code || !email) {
      return res.status(400).json({ error: 'Verification code and email are required' });
    }

    console.log('🔵 Verification attempt for email:', email);
    const tempUserData = tempUsers.get(email);
    if (!tempUserData) {
      return res.status(400).json({ 
        error: 'No registration found for this email. Please register again.' 
      });
    }

    console.log('🔵 Verification details:', {
      email: email,
      providedCode: code,
      storedCode: tempUserData.verificationCode,
      expires: tempUserData.verificationCodeExpires,
      currentTime: Date.now()
    });

    // Check if verification code expired
    if (tempUserData.verificationCodeExpires < Date.now()) {
      tempUsers.delete(email); // Clean up expired data
      return res.status(400).json({ error: 'Verification code has expired. Please register again.' });
    }

    // Check if verification code matches
    if (tempUserData.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check again if user exists in database (race condition protection)
    const existingUser = await User.findOne({ 
      $or: [{ email: tempUserData.email }, { username: tempUserData.username }] 
    });
    
    if (existingUser) {
      tempUsers.delete(email); // Clean up
      return res.status(400).json({ 
        error: 'User already exists with this email or username' 
      });
    }

    // FINALLY CREATE USER IN DATABASE - only after successful verification
    console.log('🟡 Creating user in database after successful verification...');
    const user = new User({ 
      username: tempUserData.username, 
      email: tempUserData.email, 
      password: tempUserData.password,
      isVerified: true // User is verified immediately
    });
    
    await user.save();
    console.log('🟢 User created successfully in database:', user._id);

    // Clean up temporary data
    tempUsers.delete(email);

    res.json({ 
      message: 'Email verified successfully! Your account has been created. You can now login.',
      success: true,
      userId: user._id
    });

  } catch (error) {
    console.error('🔴 Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

//  Send verification code again
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if we have temporary user data
    const tempUserData = tempUsers.get(email);
    if (!tempUserData) {
      return res.status(404).json({ error: 'No pending registration found for this email' });
    }

    // Generate new verification code
    const newVerificationCode = generateCode();
    tempUserData.verificationCode = newVerificationCode;
    tempUserData.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    
    // Update temporary data
    tempUsers.set(email, tempUserData);

    await sendVerificationEmail(email, newVerificationCode);

    res.json({ 
      message: 'New verification code sent to your email.',
      email: email
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATED: Login route - only allows verified users
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // STRICT VERIFICATION CHECK
    if (!user.isVerified) {
      return res.status(400).json({ 
        error: 'Please verify your email first. Check your email for verification code.' 
      });
    }

    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    req.session.userId = user._id;
    req.session.lastActivity = Date.now();

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        darkMode: user.darkMode
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Keep all other routes the same...
router.post('/logout', auth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

router.put('/theme', auth, async (req, res) => {
  try {
    const { darkMode } = req.body;
    
    if (typeof darkMode !== 'boolean') {
      return res.status(400).json({ 
        error: 'Valid darkMode preference is required (true or false)' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.updateDarkMode(darkMode);

    res.json({
      message: 'Theme preference updated successfully',
      darkMode: user.darkMode
    });

  } catch (error) {
    console.error('🔴 Theme update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        darkMode: user.darkMode,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('🔴 Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.resetPasswordCode) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (!user.resetPasswordCodeExpires || user.resetPasswordCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    res.json({ 
      message: 'Reset code is valid',
      valid: true 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔵 Forgot password request for email:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('🔴 No user found with email:', email);
      return res.status(404).json({ 
        success: false,
        error: 'No account found with this email address' 
      });
    }

    console.log('🟢 User found:', user._id);

    const resetCode = generateCode();
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = Date.now() + 1 * 60 * 60 * 1000;
    await user.save();

    console.log('🟡 Reset code generated:', resetCode);

    await sendPasswordResetEmail(user.email, resetCode);
    console.log('🟢 Password reset email sent');

    res.json({ 
      success: true,
      message: 'Password reset code sent to your email.',
      userId: user._id 
    });

  } catch (error) {
    console.error('🔴 Forgot password error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send reset code. Please try again.' 
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.resetPasswordCode) {
      return res.status(400).json({ error: 'No reset code found' });
    }

    if (user.resetPasswordCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpires = undefined;
    await user.save();

    res.json({ 
      message: 'Password reset successfully! You can now login with your new password.' 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      darkMode: user.darkMode,
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [email, tempUser] of tempUsers.entries()) {
    if (tempUser.verificationCodeExpires < now) {
      tempUsers.delete(email);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🟢 Cleaned up ${cleanedCount} expired temporary registrations`);
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = router;