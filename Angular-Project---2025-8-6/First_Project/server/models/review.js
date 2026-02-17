const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    productId: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true},

    userName: { type: String, default: 'Customer' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },

},
    {timestamps: true}
);

// Optional: prevent a user from submitting multiple reviews for the same product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
