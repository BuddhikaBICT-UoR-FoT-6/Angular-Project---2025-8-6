const mongoose = require('mongoose');
const OrderSchema = new mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    items: [{
        product_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
        name: {type: String, required: true},
        size: {type: String, required: true},
        color: {type: String, required: true},
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
        street: String,
        city: String,
        country: String
    },
    payment_method: {
        type: String,
        enum: ['credit_card', 'paypal', 'cash_on_delivery'],
        required: true
    },
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Order', OrderSchema);