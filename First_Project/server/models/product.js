const mongoose = require('mongoose');
const { type } = require('os');

const productSchema = new mongoose.Schema({
    name: String,
    description: String,
    category: String,
    sub_category: String,
    price: Number,
    discount: Number,
    image: [String],
    sizes: [String],
    colors: [String],
    stock: {
        S: Number,
        M: Number,
        L: Number,
        XL: Number
    },
    Created_at: {type: Date, default: Date.now},
    Updated_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Product', productSchema);