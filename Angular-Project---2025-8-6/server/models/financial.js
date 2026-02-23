const mongoose = require('mongoose');

const financialSchema = new mongoose.Schema({
    // Core transaction fields
    order_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true},
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    
    // Financial amounts
    amount: {type: Number, required: true}, // Total transaction amount
    revenue: {type: Number, default: 0}, // Revenue from sale
    cost_of_goods_sold: {type: Number, default: 0}, // COGS
    expenses: {type: Number, default: 0}, // Additional expenses (shipping, processing, etc.)
    discount_amount: {type: Number, default: 0}, // Discounts applied
    
    // Tax information
    tax_rate: {type: Number, default: 0}, // Tax rate as percentage (e.g., 10 for 10%)
    tax_amount: {type: Number, default: 0}, // Calculated tax amount
    net_amount: {type: Number, default: 0}, // Amount after tax
    
    // Transaction details
    transaction_type: {
        type: String,
        enum: ["sale", "refund", "expense", "adjustment"],
        default: "sale"
    },
    payment_status: {
        type: String,
        enum: ["paid", "pending", "refunded", "failed"],
        default: "pending"
    },
    payment_method: {
        type: String,
        enum: ["credit_card", "paypal", "cash_on_delivery", "other"],
        default: "other"
    },
    
    // Categorization
    category: {
        type: String,
        enum: ["product_sale", "shipping", "tax", "refund", "other"],
        default: "product_sale"
    },
    
    // Reporting metadata
    transaction_date: {type: Date, default: Date.now},
    fiscal_year: {type: Number}, // e.g., 2026
    fiscal_quarter: {type: Number}, // 1-4
    fiscal_month: {type: Number}, // 1-12
    fiscal_week: {type: Number}, // 1-52
    
    // Additional info
    notes: String,
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

// Pre-save middleware to calculate fiscal periods and net amount
financialSchema.pre('save', function(next) {
    const date = this.transaction_date || new Date();
    
    // Calculate fiscal periods
    this.fiscal_year = date.getFullYear();
    this.fiscal_month = date.getMonth() + 1;
    this.fiscal_quarter = Math.ceil(this.fiscal_month / 3);
    
    // Calculate week number
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    this.fiscal_week = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    
    // Calculate net amount if not set
    if (this.net_amount === 0) {
        this.net_amount = this.amount + this.tax_amount;
    }
    
    // Set revenue equal to amount for sales if not explicitly set
    if (this.transaction_type === 'sale' && this.revenue === 0) {
        this.revenue = this.amount;
    }
    
    this.updated_at = new Date();
    next();
});

module.exports = mongoose.model('Financial', financialSchema);
