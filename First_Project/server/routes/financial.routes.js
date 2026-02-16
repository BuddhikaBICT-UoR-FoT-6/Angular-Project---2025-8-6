const express = require('express');
const router = express.Router();

const Financial = require('../models/financial');
const Order = require('../models/order');
const {
  aggregateByPeriod,
  generateSalesAnalytics,
  calculateCategoryBreakdown,
  generateExcelReport,
  generatePDFReport,
  calculateTax,
  calculateProfitLoss,
  DEFAULT_TAX_RATE
} = require('../utils/financialUtils');

// ============================================
// REVENUE REPORTS
// ============================================

/**
 * GET /api/financial/revenue-report
 * Generate revenue reports with date range and period filters
 * Query params: period (daily/weekly/monthly), startDate, endDate
 */
router.get('/revenue-report', async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch financial records
    const records = await Financial.find(filter).sort({ transaction_date: 1 });

    // Aggregate by period
    const aggregated = aggregateByPeriod(records, period);

    res.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      data: aggregated,
      summary: {
        totalRevenue: aggregated.reduce((sum, item) => sum + item.revenue, 0),
        totalProfit: aggregated.reduce((sum, item) => sum + item.profit, 0),
        totalTax: aggregated.reduce((sum, item) => sum + item.tax, 0),
        totalTransactions: aggregated.reduce((sum, item) => sum + item.transactions, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// SALES ANALYTICS
// ============================================

/**
 * GET /api/financial/sales-analytics
 * Generate sales analytics data for charts
 * Query params: period (daily/weekly/monthly), startDate, endDate
 */
router.get('/sales-analytics', async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch financial records
    const records = await Financial.find(filter).sort({ transaction_date: 1 });

    // Generate analytics
    const analytics = generateSalesAnalytics(records, period);
    const categoryBreakdown = calculateCategoryBreakdown(records);

    res.json({
      success: true,
      period,
      chartData: analytics,
      categoryBreakdown,
      totalRecords: records.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// PROFIT/LOSS STATEMENT
// ============================================

/**
 * GET /api/financial/profit-loss
 * Calculate profit/loss statement
 * Query params: startDate, endDate
 */
router.get('/profit-loss', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch financial records
    const records = await Financial.find(filter);

    // Calculate totals
    const totalRevenue = records.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const totalCOGS = records.reduce((sum, r) => sum + (r.cost_of_goods_sold || 0), 0);
    const totalExpenses = records.reduce((sum, r) => sum + (r.expenses || 0), 0);
    const totalTax = records.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
    const totalDiscount = records.reduce((sum, r) => sum + (r.discount_amount || 0), 0);

    // Calculate gross profit
    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;

    // Calculate net profit
    const netProfit = calculateProfitLoss(totalRevenue, totalCOGS, totalExpenses, totalTax);
    const netProfitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      dateRange: { startDate, endDate },
      statement: {
        revenue: {
          gross_revenue: totalRevenue,
          discounts: totalDiscount,
          net_revenue: totalRevenue - totalDiscount
        },
        costs: {
          cost_of_goods_sold: totalCOGS,
          operating_expenses: totalExpenses,
          total_costs: totalCOGS + totalExpenses
        },
        profit: {
          gross_profit: grossProfit,
          gross_profit_margin: `${grossProfitMargin}%`,
          operating_profit: grossProfit - totalExpenses,
          tax: totalTax,
          net_profit: netProfit,
          net_profit_margin: `${netProfitMargin}%`
        }
      },
      transactionCount: records.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// TAX SUMMARY
// ============================================

/**
 * GET /api/financial/tax-summary
 * Generate tax calculation summary
 * Query params: startDate, endDate, period
 */
router.get('/tax-summary', async (req, res) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch financial records
    const records = await Financial.find(filter).sort({ transaction_date: 1 });

    // Aggregate by period
    const aggregated = aggregateByPeriod(records, period);

    // Calculate tax summary
    const totalTaxCollected = records.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
    const totalTaxableAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const averageTaxRate = records.length > 0
      ? (records.reduce((sum, r) => sum + (r.tax_rate || 0), 0) / records.length).toFixed(2)
      : DEFAULT_TAX_RATE;

    res.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      summary: {
        total_tax_collected: totalTaxCollected,
        total_taxable_amount: totalTaxableAmount,
        average_tax_rate: `${averageTaxRate}%`,
        transactions_count: records.length
      },
      breakdown: aggregated.map(item => ({
        period: item.period,
        tax_collected: item.tax,
        revenue: item.revenue,
        transactions: item.transactions
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

/**
 * GET /api/financial/export/excel
 * Export financial report as Excel
 * Query params: period, startDate, endDate
 */
router.get('/export/excel', async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch and aggregate data
    const records = await Financial.find(filter).sort({ transaction_date: 1 });
    const aggregated = aggregateByPeriod(records, period);

    // Generate Excel
    const buffer = await generateExcelReport(aggregated, 'revenue');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/financial/export/pdf
 * Export financial report as PDF
 * Query params: period, startDate, endDate
 */
router.get('/export/pdf', async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Fetch and aggregate data
    const records = await Financial.find(filter).sort({ transaction_date: 1 });
    const aggregated = aggregateByPeriod(records, period);

    // Generate PDF
    const buffer = await generatePDFReport(aggregated, 'revenue');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report-${Date.now()}.pdf`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// SYNC ORDERS TO FINANCIAL RECORDS
// ============================================

/**
 * POST /api/financial/sync-orders
 * Sync order data to financial records
 * Body: { startDate, endDate, taxRate }
 */
router.post('/sync-orders', async (req, res) => {
  try {
    const { startDate, endDate, taxRate = DEFAULT_TAX_RATE } = req.body;

    // Build query filter for orders
    const filter = { status: 'delivered' };
    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) filter.created_at.$gte = new Date(startDate);
      if (endDate) filter.created_at.$lte = new Date(endDate);
    }

    // Fetch delivered orders
    const orders = await Order.find(filter);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      // Check if financial record already exists
      const existing = await Financial.findOne({ order_id: order._id });
      if (existing) {
        skippedCount++;
        continue;
      }

      // Calculate financial details
      const revenue = order.total_amount - (order.discount_amount || 0);
      const taxAmount = calculateTax(revenue, taxRate);

      // Create financial record
      await new Financial({
        order_id: order._id,
        user_id: order.user_id,
        amount: order.total_amount,
        revenue: revenue,
        cost_of_goods_sold: 0, // Would need product cost data
        expenses: 0, // Could include shipping costs
        discount_amount: order.discount_amount || 0,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        net_amount: revenue + taxAmount,
        transaction_type: 'sale',
        payment_status: 'paid',
        payment_method: order.payment_method,
        category: 'product_sale',
        transaction_date: order.created_at,
        notes: `Synced from order ${order._id}`
      }).save();

      syncedCount++;
    }

    res.json({
      success: true,
      message: `Synced ${syncedCount} orders to financial records`,
      synced: syncedCount,
      skipped: skippedCount,
      total: orders.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

// Get all financial records
router.get('/', async (req, res) => {
  try {
    const records = await Financial.find()
      .populate('order_id', 'total_amount status')
      .populate('user_id', 'name email')
      .sort({ transaction_date: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new financial record
router.post('/', async (req, res) => {
  try {
    const record = await new Financial(req.body).save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update financial record
router.put('/:id', async (req, res) => {
  try {
    const record = await Financial.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete financial record
router.delete('/:id', async (req, res) => {
  try {
    await Financial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Financial record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

