const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Generate a secure password reset token
 * @returns {string} - Random token
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid email
 */
function validateEmail(email) {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number
 * @returns {boolean} - True if valid phone
 */
function validatePhone(phone) {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
}

/**
 * Generate password reset expiry time (1 hour from now)
 * @returns {Date} - Expiry date
 */
function getResetTokenExpiry() {
    return new Date(Date.now() + 3600000); // 1 hour
}

/**
 * Sanitize user object for response (remove sensitive data)
 * @param {Object} user - User object
 * @returns {Object} - Sanitized user object
 */
function sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    return userObj;
}

/**
 * Check if user has permission based on role
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean} - True if user has permission
 */
function hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
        'superadmin': 5,
        'admin': 4,
        'supplier': 3,
        'customer': 2,
        'visitor': 1
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get user activity summary
 * @param {Array} activityLog - User's activity log
 * @returns {Object} - Activity summary
 */
function getActivitySummary(activityLog) {
    const summary = {
        totalActivities: activityLog.length,
        recentActivities: activityLog.slice(-10).reverse(),
        activityCounts: {}
    };

    activityLog.forEach(activity => {
        summary.activityCounts[activity.action] = (summary.activityCounts[activity.action] || 0) + 1;
    });

    return summary;
}

/**
 * Format user data for display
 * @param {Object} user - User object
 * @returns {Object} - Formatted user data
 */
function formatUserData(user) {
    return {
        id: user._id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        profileImage: user.profile_image,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        createdAt: user.created_at,
        updatedAt: user.updated_at
    };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with isValid and message
 */
function validatePasswordStrength(password) {
    if (password.length < 6) {
        return { isValid: false, message: 'Password must be at least 6 characters long' };
    }

    if (password.length > 128) {
        return { isValid: false, message: 'Password must be less than 128 characters' };
    }

    // Optional: Add more strength requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

    return {
        isValid: true,
        strength: strength,
        message: strength >= 3 ? 'Strong password' : strength >= 2 ? 'Medium password' : 'Weak password'
    };
}

module.exports = {
    hashPassword,
    comparePassword,
    generateResetToken,
    validateEmail,
    validatePhone,
    getResetTokenExpiry,
    sanitizeUser,
    hasPermission,
    getActivitySummary,
    formatUserData,
    validatePasswordStrength
};
