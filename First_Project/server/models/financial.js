const { transcode } = require('buffer');
const mongoose = require('mongoose');

const financialSchema = new mongoose.Schema({
    order_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true},
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    amount: {type: Number, required: true},
    Payment_status: {
        type: String,
        enum: ["paid", "pending", "refunded"],
        default: "pending"
    },
    transaction_date: {type: Date, default: Date.now},
    notes: String,
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Financial', financialSchema);
