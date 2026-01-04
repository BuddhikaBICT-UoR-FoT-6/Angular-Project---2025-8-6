const mongoose = require('mongoose');
const OrderSchema = new mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    items: [{
        product_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
        name: {type: String, required: true},
        size: {type: String, required: true},
        color: {type: String, default: ''},
        quantity: {type: Number, required: true},
        price: {type: Number, required: true}

    }],
    total_amount: {type: Number, required: true},
    status: {
            type: String,
            enum: ['pending', 'shipped', 'delivered', 'cancelled'],
            default: 'pending'
    },
    shipping_address: {
        fullName: { type: String, default: '' },
        phone: { type: String, default: '' },
        street: { type: String, default: '' },
        line1: { type: String, default: '' },
        line2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        postalCode: { type: String, default: '' },
        country: { type: String, default: '' }
    },
    payment_method: {
        type: String,
        enum: ['credit_card', 'paypal', 'cash_on_delivery'],
        required: true
    },
    coupon_code: { type: String, default: '' },
    discount_amount: { type: Number, default: 0 },
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Order', OrderSchema);