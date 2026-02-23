/**
 * Migration script to hash existing plain-text passwords
 * Run this once after implementing bcrypt authentication
 * 
 * Usage: node migrations/hash-passwords.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/user');

async function hashExistingPasswords() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users
    const users = await User.find();
    console.log(`📊 Found ${users.length} users to process`);

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with $2)
      if (user.password && user.password.startsWith('$2')) {
        console.log(`⏭️  Skipping ${user.email} - already hashed`);
        skipped++;
        continue;
      }

      if (!user.password) {
        console.log(`⚠️  Skipping ${user.email} - no password`);
        skipped++;
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
      await user.save();
      
      console.log(`✅ Updated ${user.email}`);
      updated++;
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📊 Total: ${users.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

hashExistingPasswords();
