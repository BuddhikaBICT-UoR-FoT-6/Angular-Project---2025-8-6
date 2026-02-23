# 📧 Email OTP Verification System

Complete guide for the email-based OTP verification system implemented for user registration, password reset, and future account management features.

## 🎯 Features Implemented

### ✅ Current Features
1. **Registration with Email Verification**
   - User enters registration details
   - 6-digit OTP sent to email
   - Email verification required before account creation
   - Auto-login after successful verification

2. **Forgot Password / Password Reset**
   - User requests password reset
   - 6-digit OTP sent to email
   - Verify OTP before setting new password
   - Secure token-based password reset flow

### 🔮 Future Features (Ready for Implementation)
3. **Account Deactivation (Temporary)**
   - OTP verification required
   - 30-day grace period before permanent deletion
   - Email notifications at intervals

4. **Account Deletion (Permanent)**
   - OTP verification required
   - Immediate permanent deletion
   - Final confirmation email sent

## 🏗️ Architecture

### Backend Components

#### 1. OTP Model (`server/models/otp.js`)
- Stores OTP codes with expiry
- Tracks verification attempts (max 5)
- Auto-deletes expired OTPs via MongoDB TTL index
- Supports multiple purposes: registration, password-reset, account-deactivation, account-deletion

```javascript
{
  email: String,
  otp: String (6 digits),
  purpose: Enum ['registration', 'password-reset', 'account-deactivation', 'account-deletion'],
  verified: Boolean,
  attempts: Number (max 5),
  expiresAt: Date (10 minutes),
  createdAt: Date
}
```

#### 2. Email Service (`server/utils/emailService.js`)
- **Development Mode**: Logs emails to console (no actual sending)
- **Production Mode**: Uses nodemailer with configured email service
- Beautiful HTML email templates
- Functions:
  - `generateOTP()` - Creates random 6-digit code
  - `sendRegistrationOTP(email, otp, fullName)`
  - `sendPasswordResetOTP(email, otp, fullName)`
  - `sendAccountActionOTP(email, otp, fullName, action)`

#### 3. Server Endpoints (`server/server.js`)

**Registration Flow:**
```
POST /api/auth/send-registration-otp
Body: { email, full_name }
Response: { success, message, expiresIn }

POST /api/auth/verify-registration-otp
Body: { email, otp, password, full_name, phone, address }
Response: { success, message, token, user }
```

**Password Reset Flow:**
```
POST /api/auth/forgot-password
Body: { email }
Response: { success, message, expiresIn }

POST /api/auth/verify-reset-otp
Body: { email, otp }
Response: { success, message, resetToken }

POST /api/auth/reset-password
Body: { resetToken, newPassword }
Response: { success, message }
```

### Frontend Components

#### 1. OTP Input Component (`src/app/shared/otp-input/otp-input.ts`)
Reusable component for OTP verification:
- 6 individual digit inputs
- Auto-focus next input on digit entry
- Paste support (auto-fills all 6 digits)
- Countdown timer (10 minutes)
- Resend OTP with cooldown (60 seconds)
- Error handling and retry attempts
- Beautiful purple gradient design

**Usage:**
```html
<app-otp-input
  [title]="'Verify Your Email'"
  [description]="'We sent a 6-digit code to ' + email"
  [expirySeconds]="600"
  [resendDelay]="60"
  (verify)="onVerifyOtp($event)"
  (resend)="onResendOtp()"
></app-otp-input>
```

#### 2. Registration Component (`src/app/customer/register/`)
Two-step registration process:
- **Step 1**: User fills registration form
- **Step 2**: OTP verification
- Auto-login after successful verification

#### 3. Forgot Password Component (`src/app/customer/forgot-password/`)
Three-step password reset:
- **Step 1**: Enter email
- **Step 2**: Verify OTP
- **Step 3**: Set new password

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install nodemailer
```

### 2. Configure Email Service

#### Development Mode (Default)
No configuration needed! Emails will be logged to console:
```
📧 EMAIL SIMULATION (Development Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: user@example.com
Subject: Verify Your Email - Clothing Store
Body: [HTML content with OTP]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Production Mode (Gmail Example)
Add to `server/.env`:
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

**Gmail Setup:**
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password: https://myaccount.google.com/apppasswords
4. Use the 16-character app password in `.env`

**Other Email Services:**
- **Outlook**: Use regular password
- **SendGrid**: Configure SMTP settings
- **AWS SES**: Configure AWS credentials
- **Custom SMTP**: Update `createTransporter()` in emailService.js

### 3. Test the System

1. **Start Backend:**
   ```bash
   cd server
   node server.js
   ```

2. **Start Frontend:**
   ```bash
   cd ..
   npm start
   ```

3. **Test Registration:**
   - Navigate to http://localhost:4202/register
   - Fill in registration form
   - Check console for OTP (development mode)
   - Enter OTP to complete registration

4. **Test Password Reset:**
   - Navigate to http://localhost:4202/forgot-password
   - Enter email address
   - Check console for OTP
   - Verify OTP and set new password

## 🔒 Security Features

1. **OTP Expiry**: Codes expire after 10 minutes
2. **Rate Limiting**: Maximum 5 verification attempts per OTP
3. **Auto-Cleanup**: Expired OTPs automatically deleted by MongoDB
4. **Secure Token**: Password reset uses secure tokens
5. **No Password Leakage**: Never store plain text passwords
6. **Email Privacy**: Don't reveal if email exists (forgot password)

## 📱 User Experience Features

1. **Auto-Focus**: Automatically moves to next digit input
2. **Paste Support**: Paste 6-digit code from clipboard
3. **Visual Timer**: Countdown showing time remaining
4. **Resend Cooldown**: 60-second cooldown before resending
5. **Error Messages**: Clear feedback on invalid OTP
6. **Beautiful Emails**: Professional HTML email templates
7. **Responsive Design**: Works on mobile and desktop

## 🧪 Testing Checklist

### Registration Flow
- [ ] Email validation works
- [ ] OTP sent successfully
- [ ] Invalid OTP shows error
- [ ] Expired OTP shows error
- [ ] Valid OTP creates account
- [ ] Auto-login after registration
- [ ] Duplicate email blocked

### Password Reset Flow
- [ ] Email validation works
- [ ] OTP sent successfully
- [ ] Invalid OTP shows error
- [ ] Valid OTP allows password reset
- [ ] New password login works
- [ ] Old password no longer works

### OTP Component
- [ ] 6 digits required
- [ ] Auto-focus works
- [ ] Paste works
- [ ] Timer counts down
- [ ] Resend button enabled after cooldown
- [ ] Error messages display

## 🔮 Future Implementation: Account Management

### Account Deactivation
```javascript
// Backend endpoint (ready to implement)
POST /api/account/deactivate
Headers: Authorization: Bearer {token}
Body: { otp }

// Add to User model:
{
  status: Enum ['active', 'deactivated'],
  deactivatedAt: Date,
  scheduledDeletionAt: Date
}

// Cron job for auto-deletion:
- Run daily
- Find users where scheduledDeletionAt < now
- Delete user and all associated data
- Send final notification email
```

### Account Deletion
```javascript
// Backend endpoint (ready to implement)
POST /api/account/delete
Headers: Authorization: Bearer {token}
Body: { otp }

// Immediate deletion:
- Verify OTP
- Delete user
- Delete all user data (orders, cart, etc.)
- Send confirmation email
```

## 📊 Database Indexes

Ensure these indexes exist for optimal performance:
```javascript
// OTP Collection
db.otps.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
db.otps.createIndex({ "email": 1, "purpose": 1, "verified": 1 })

// User Collection
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "status": 1, "scheduledDeletionAt": 1 })
```

## 🎨 Customization

### Email Templates
Edit `server/utils/emailService.js` to customize:
- Email design and branding
- Colors and fonts
- Logo and images
- Email content and tone

### OTP Settings
Edit the following constants:
```javascript
// OTP expiry (server/server.js)
expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

// Resend cooldown (frontend component)
[resendDelay]="60" // 60 seconds

// Max attempts
if (otpRecord.attempts >= 5) // 5 attempts
```

## 🐛 Troubleshooting

### OTP Not Received (Development)
- Check server console for email output
- Verify email address is correct

### OTP Not Received (Production)
- Check EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD in .env
- Verify email service credentials
- Check spam folder
- Review server logs for errors

### "Invalid OTP" Error
- Ensure correct digits entered
- Check OTP hasn't expired (10 minutes)
- Verify case sensitivity (shouldn't matter for numbers)
- Maximum 5 attempts per OTP

### Server Errors
- Check MongoDB connection
- Verify all dependencies installed
- Check server logs for specific errors
- Ensure OTP model is properly imported

## 📚 API Documentation

Full API documentation available in `server/API_DOCUMENTATION.md`

## 🎉 Success!

Your OTP verification system is now ready! Users can:
- ✅ Register with email verification
- ✅ Reset forgotten passwords securely
- 🔮 Future: Manage account deactivation/deletion (when implemented)

## 📝 Notes

- OTP codes are 6 random digits (100000-999999)
- All OTP operations are logged in server console
- MongoDB TTL index auto-cleans expired OTPs
- Frontend uses purple gradient theme (#667eea → #764ba2)
- All emails include security warnings about not sharing OTP
