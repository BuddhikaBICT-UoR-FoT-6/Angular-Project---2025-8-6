const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Generate a generic Excel report
 * @param {Array} data - Array of objects containing the data
 * @param {Array} columns - Array of column definitions { header: 'Name', key: 'key', width: 15 }
 * @param {String} sheetName - Name of the worksheet
 * @returns {Buffer} - Excel file buffer
 */
async function generateGenericExcelReport(data, columns, sheetName = 'Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Set columns
    worksheet.columns = columns;

    // Add rows
    data.forEach(row => {
        worksheet.addRow(row);
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' } // Light gray background
    };

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate a generic PDF report
 * @param {Array} data - Array of objects containing the data
 * @param {Array} columns - Array of column definitions { header: 'Name', key: 'key', width: 70, format: Function(val) }
 * @param {String} title - Title of the report
 * @returns {Promise<Buffer>} - PDF file buffer
 */
function generateGenericPDFReport(data, columns, title = 'Report') {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, layout: columns.length > 6 ? 'landscape' : 'portrait' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Calculate total table width to center it if needed, or just start from margin
        const tableTop = doc.y;
        let currentX = 50;

        // Table header
        doc.fontSize(10).font('Helvetica-Bold');
        columns.forEach(col => {
            doc.text(col.header, currentX, tableTop, { width: col.width || 70, align: col.align || 'left' });
            currentX += (col.width || 70);
        });

        // Add a line under header
        doc.moveTo(50, tableTop + 15).lineTo(currentX, tableTop + 15).stroke();

        // Table rows
        doc.font('Helvetica');
        let yPosition = tableTop + 25;

        data.forEach((row, index) => {
            // Check page break
            const pageHeight = doc.page.height - 50;
            if (yPosition > pageHeight - 30) {
                doc.addPage();
                yPosition = 50;

                // Redraw table header on new page
                currentX = 50;
                doc.font('Helvetica-Bold');
                columns.forEach(col => {
                    doc.text(col.header, currentX, yPosition, { width: col.width || 70, align: col.align || 'left' });
                    currentX += (col.width || 70);
                });
                doc.moveTo(50, yPosition + 15).lineTo(currentX, yPosition + 15).stroke();
                doc.font('Helvetica');
                yPosition += 25;
            }

            currentX = 50;
            columns.forEach(col => {
                let val = row[col.key];
                if (col.format && typeof col.format === 'function') {
                    val = col.format(val);
                } else if (val === null || val === undefined) {
                    val = '';
                } else {
                    val = String(val);
                }

                doc.text(val, currentX, yPosition, { width: col.width || 70, align: col.align || 'left' });
                currentX += (col.width || 70);
            });

            yPosition += 20; // Row height
        });

        doc.end();
    });
}

module.exports = {
    generateGenericExcelReport,
    generateGenericPDFReport
};
