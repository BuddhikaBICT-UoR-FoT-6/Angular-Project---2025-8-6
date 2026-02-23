const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Financial utility functions for calculations and report generation
 */

// Default tax rate (can be overridden)
const DEFAULT_TAX_RATE = 10; // 10%

/**
 * Calculate tax amount based on taxable amount and rate
 */
function calculateTax(taxableAmount, taxRate = DEFAULT_TAX_RATE) {
    return (taxableAmount * taxRate) / 100;
}

/**
 * Calculate profit/loss
 * Formula: Profit = Revenue - COGS - Expenses - Tax
 */
function calculateProfitLoss(revenue, cogs, expenses, taxAmount) {
    return revenue - cogs - expenses - taxAmount;
}

/**
 * Calculate profit margin percentage
 */
function calculateProfitMargin(profit, revenue) {
    if (revenue === 0) return 0;
    return ((profit / revenue) * 100).toFixed(2);
}

/**
 * Aggregate financial data by time period
 */
function aggregateByPeriod(financialRecords, period = 'daily') {
    const aggregated = {};

    financialRecords.forEach(record => {
        let key;
        const date = new Date(record.transaction_date);

        switch (period) {
            case 'daily':
                key = date.toISOString().split('T')[0]; // YYYY-MM-DD
                break;
            case 'weekly':
                key = `${record.fiscal_year}-W${record.fiscal_week}`;
                break;
            case 'monthly':
                key = `${record.fiscal_year}-${String(record.fiscal_month).padStart(2, '0')}`;
                break;
            case 'quarterly':
                key = `${record.fiscal_year}-Q${record.fiscal_quarter}`;
                break;
            case 'yearly':
                key = `${record.fiscal_year}`;
                break;
            default:
                key = date.toISOString().split('T')[0];
        }

        if (!aggregated[key]) {
            aggregated[key] = {
                period: key,
                revenue: 0,
                cogs: 0,
                expenses: 0,
                tax: 0,
                net_amount: 0,
                transactions: 0,
                profit: 0
            };
        }

        aggregated[key].revenue += record.revenue || 0;
        aggregated[key].cogs += record.cost_of_goods_sold || 0;
        aggregated[key].expenses += record.expenses || 0;
        aggregated[key].tax += record.tax_amount || 0;
        aggregated[key].net_amount += record.net_amount || 0;
        aggregated[key].transactions += 1;
    });

    // Calculate profit for each period
    Object.keys(aggregated).forEach(key => {
        const data = aggregated[key];
        data.profit = calculateProfitLoss(data.revenue, data.cogs, data.expenses, data.tax);
        data.profit_margin = calculateProfitMargin(data.profit, data.revenue);
    });

    return Object.values(aggregated).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Generate sales analytics for charts
 */
function generateSalesAnalytics(financialRecords, period = 'monthly') {
    const aggregated = aggregateByPeriod(financialRecords, period);

    return {
        labels: aggregated.map(item => item.period),
        revenue: aggregated.map(item => item.revenue),
        profit: aggregated.map(item => item.profit),
        expenses: aggregated.map(item => item.expenses),
        tax: aggregated.map(item => item.tax),
        transactions: aggregated.map(item => item.transactions)
    };
}

/**
 * Calculate category breakdown for pie charts
 */
function calculateCategoryBreakdown(financialRecords) {
    const breakdown = {};

    financialRecords.forEach(record => {
        const category = record.category || 'other';
        if (!breakdown[category]) {
            breakdown[category] = {
                category,
                revenue: 0,
                count: 0
            };
        }
        breakdown[category].revenue += record.revenue || 0;
        breakdown[category].count += 1;
    });

    return Object.values(breakdown);
}

/**
 * Generate Excel report
 */
async function generateExcelReport(data, reportType = 'revenue') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');

    // Set up columns based on report type
    if (reportType === 'revenue') {
        worksheet.columns = [
            { header: 'Period', key: 'period', width: 15 },
            { header: 'Revenue', key: 'revenue', width: 15 },
            { header: 'COGS', key: 'cogs', width: 15 },
            { header: 'Expenses', key: 'expenses', width: 15 },
            { header: 'Tax', key: 'tax', width: 15 },
            { header: 'Profit', key: 'profit', width: 15 },
            { header: 'Profit Margin %', key: 'profit_margin', width: 18 },
            { header: 'Transactions', key: 'transactions', width: 15 }
        ];

        // Add rows
        data.forEach(row => {
            worksheet.addRow(row);
        });

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4CAF50' }
        };
    }

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate PDF report
 */
function generatePDFReport(data, reportType = 'revenue') {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Financial Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Report Type: ${reportType.toUpperCase()}`, { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Table header
        const tableTop = doc.y;
        const colWidth = 70;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Period', 50, tableTop, { width: colWidth });
        doc.text('Revenue', 50 + colWidth, tableTop, { width: colWidth });
        doc.text('Expenses', 50 + colWidth * 2, tableTop, { width: colWidth });
        doc.text('Tax', 50 + colWidth * 3, tableTop, { width: colWidth });
        doc.text('Profit', 50 + colWidth * 4, tableTop, { width: colWidth });
        doc.text('Margin %', 50 + colWidth * 5, tableTop, { width: colWidth });

        // Table rows
        doc.font('Helvetica');
        let yPosition = tableTop + 20;

        data.forEach((row, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(row.period || '', 50, yPosition, { width: colWidth });
            doc.text(`$${(row.revenue || 0).toFixed(2)}`, 50 + colWidth, yPosition, { width: colWidth });
            doc.text(`$${(row.expenses || 0).toFixed(2)}`, 50 + colWidth * 2, yPosition, { width: colWidth });
            doc.text(`$${(row.tax || 0).toFixed(2)}`, 50 + colWidth * 3, yPosition, { width: colWidth });
            doc.text(`$${(row.profit || 0).toFixed(2)}`, 50 + colWidth * 4, yPosition, { width: colWidth });
            doc.text(`${row.profit_margin || 0}%`, 50 + colWidth * 5, yPosition, { width: colWidth });

            yPosition += 20;
        });

        // Summary
        doc.moveDown(3);
        doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown();

        const totalRevenue = data.reduce((sum, row) => sum + (row.revenue || 0), 0);
        const totalProfit = data.reduce((sum, row) => sum + (row.profit || 0), 0);
        const totalTax = data.reduce((sum, row) => sum + (row.tax || 0), 0);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`);
        doc.text(`Total Profit: $${totalProfit.toFixed(2)}`);
        doc.text(`Total Tax: $${totalTax.toFixed(2)}`);
        doc.text(`Overall Profit Margin: ${calculateProfitMargin(totalProfit, totalRevenue)}%`);

        doc.end();
    });
}

module.exports = {
    calculateTax,
    calculateProfitLoss,
    calculateProfitMargin,
    aggregateByPeriod,
    generateSalesAnalytics,
    calculateCategoryBreakdown,
    generateExcelReport,
    generatePDFReport,
    DEFAULT_TAX_RATE
};
