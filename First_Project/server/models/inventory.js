const mongoose = require('mongoose');
const product = require('./product');

const inventorySchema = new mongoose.Schema({
    product_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
    stock_by_size: {
        S: {type: Number, required: true},
        M: {type: Number, required: true},
        L: {type: Number, required: true},
        XL: {type: Number, required: true}
    },
    last_restoked: {type: Date, default: Date.now},
    supplier: String,
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}

});

module.exports = mongoose.model('Inventory', inventorySchema);
