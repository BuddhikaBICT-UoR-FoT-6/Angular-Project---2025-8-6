const jwt = require('jsonwebtoken');

// JWT secret key - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
function generateToken(userId, role) {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token middleware
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Add user info to request

    // Check if token is blacklisted
    const TokenBlacklist = require('../models/tokenBlacklist');
    TokenBlacklist.findOne({ token }).then(blacklisted => {
      if (blacklisted) {
        return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
      }
      next();
    }).catch(err => {
      console.error('Error checking token blacklist:', err);
      next(); // Fail open if DB check fails
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check if user has required role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Optional authentication - adds user info if token exists but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token is blacklisted
    const TokenBlacklist = require('../models/tokenBlacklist');
    TokenBlacklist.findOne({ token }).then(blacklisted => {
      if (!blacklisted) {
        req.user = decoded;
      }
      next();
    }).catch(err => {
      console.error('Error checking token blacklist in optionalAuth:', err);
      next();
    });
  } catch (err) {
    // Invalid token but continue anyway
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  requireRole,
  optionalAuth,
  JWT_SECRET
};
