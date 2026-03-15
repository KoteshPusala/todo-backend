const nodemailer = require('nodemailer');

// Create transporter with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail
    pass: process.env.EMAIL_PASS  // Your Gmail App Password
  }
});

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    console.log('🟡 Attempting to send verification email via Gmail to:', email);
    
    const mailOptions = {
      from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your TaskFlow Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #f9fafb; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .code { background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: #059669; margin: 0;">TaskFlow</h2>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Verify Your Email Address</p>
            </div>
            
            <p>Hello,</p>
            <p>Thank you for registering with TaskFlow! Use the verification code below to complete your registration:</p>
            
            <div class="code">${verificationCode}</div>
            
            <p>Enter this code in the verification window to activate your account.</p>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <div class="footer">
              <p>If you didn't create an account with TaskFlow, please ignore this email.</p>
              <p>&copy; 2024 TaskFlow. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully via Gmail to:', email);
    console.log('📧 Message ID:', info.messageId);
    return { success: true, message: 'Verification email sent successfully' };
    
  } catch (error) {
    console.error('❌ Gmail sending failed:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    console.log('🟡 Attempting to send password reset email via Gmail to:', email);
    
    const mailOptions = {
      from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your TaskFlow Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #f9fafb; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .code { background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color:  #059669; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color:  #059669; margin: 0;">TaskFlow</h2>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Password Reset Request</p>
            </div>
            
            <p>Hello,</p>
            <p>We received a request to reset your password. Use the code below to reset your password:</p>
            
            <div class="code">${resetCode}</div>
            
            <p>Enter this code in the password reset window to continue.</p>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <p>If you didn't request a password reset, please ignore this email.</p>
            
            <div class="footer">
              <p>&copy; 2024 TaskFlow. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Password reset email sent via Gmail to:', email);
    console.log('📧 Message ID:', info.messageId);
    return { success: true, message: 'Password reset email sent successfully' };
    
  } catch (error) {
    console.error('❌ Password reset email failed:', error);
    throw new Error('Failed to send password reset email. Please try again.');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};