const { count } = require('console');
const mongoose = require('mongoose');
const { create } = require('./product');

const userSchema = new mongoose.Schema({
    role: {type: String, enum: ['superadmin', 'admin', 'customer', 'visitor'], default: 'visitor'},
    full_name: String,
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    phone: String,
    address: {
        street: String,
        city: String,
        country: String
    },
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('User', userSchema);