const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    role: {type: String, enum: ['superadmin', 'admin', 'customer', 'visitor'], default: 'visitor'},
    full_name: String,
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    phone: String,
    address: {
        // Kept for backwards compatibility with existing code.
        // UI labels can map these fields as:
        // - street => street name
        // - city => nearest largest city
        street: String,
        city: String,
        country: String,
        houseNo: String
    },
    profile_image: String,
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

userSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

module.exports = mongoose.model('User', userSchema);