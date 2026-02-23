const mongoose = require('mongoose');

// Activity Log Schema
const activityLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['login', 'logout', 'profile_update', 'password_change', 'role_change', 'status_change', 'created', 'deleted']
    },
    description: String,
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const userSchema = new mongoose.Schema({
    role: { type: String, enum: ['superadmin', 'admin', 'supplier', 'customer', 'visitor'], default: 'visitor' },
    full_name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    address: {
        street: String,
        city: String,
        country: String,
        houseNo: String
    },
    addresses: [{
        label: String,
        street: String,
        city: String,
        country: String,
        houseNo: String,
        isDefault: { type: Boolean, default: false }
    }],
    paymentMethods: [{
        type: String,
        last4: String,
        expiryMonth: Number,
        expiryYear: Number,
        isDefault: { type: Boolean, default: false }
    }],
    emailPreferences: {
        marketing: { type: Boolean, default: true },
        orderUpdates: { type: Boolean, default: true },
        newsletter: { type: Boolean, default: false }
    },
    profile_image: String,

    // User Management Fields
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: {
        type: Date,
        default: null
    },
    loginCount: {
        type: Number,
        default: 0
    },
    activityLog: [activityLogSchema],
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// Method to add activity log
userSchema.methods.addActivity = function (action, description, performedBy = null, ipAddress = null, userAgent = null) {
    this.activityLog.push({
        action,
        description,
        performedBy,
        ipAddress,
        userAgent,
        timestamp: new Date()
    });

    // Keep only last 100 activities
    if (this.activityLog.length > 100) {
        this.activityLog = this.activityLog.slice(-100);
    }

    return this.save();
};

// Method to update last login
userSchema.methods.updateLastLogin = function (ipAddress = null, userAgent = null) {
    this.lastLogin = new Date();
    this.loginCount += 1;
    this.addActivity('login', 'User logged in', this._id, ipAddress, userAgent);
    return this.save();
};

// Method to check if user is active
userSchema.methods.isActive = function () {
    return this.status === 'active';
};

// Method to check if password reset token is valid
userSchema.methods.isResetTokenValid = function () {
    if (!this.resetPasswordToken || !this.resetPasswordExpires) {
        return false;
    }
    return this.resetPasswordExpires > Date.now();
};

userSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});

module.exports = mongoose.model('User', userSchema);