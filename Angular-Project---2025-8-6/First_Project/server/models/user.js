const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    role: {type: String, enum: ['superadmin', 'admin', 'supplier', 'customer', 'visitor'], default: 'visitor'},
    full_name: String,
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
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
        isDefault: {type: Boolean, default: false}
    }],
    paymentMethods: [{
        type: String,
        last4: String,
        expiryMonth: Number,
        expiryYear: Number,
        isDefault: {type: Boolean, default: false}
    }],
    emailPreferences: {
        marketing: {type: Boolean, default: true},
        orderUpdates: {type: Boolean, default: true},
        newsletter: {type: Boolean, default: false}
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