import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancialService, RevenueReportResponse, SalesAnalyticsResponse, ProfitLossResponse, TaxSummaryResponse } from '../../services/financial.service';

@Component({
  selector: 'app-financials',
  imports: [CommonModule, FormsModule],
  templateUrl: './financials.html',
  styleUrl: './financials.css'
})
export class Financials implements OnInit {
  // Loading states
  loading = {
    revenue: false,
    analytics: false,
    profitLoss: false,
    tax: false
  };

  // Date filters
  selectedPeriod: 'daily' | 'weekly' | 'monthly' = 'monthly';
  startDate: string = '';
  endDate: string = '';
  quickFilter: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom' = 'month';

  // Data
  revenueReport: RevenueReportResponse | null = null;
  salesAnalytics: SalesAnalyticsResponse | null = null;
  profitLoss: ProfitLossResponse | null = null;
  taxSummary: TaxSummaryResponse | null = null;

  // Active tab
  activeTab: 'revenue' | 'analytics' | 'profitLoss' | 'tax' = 'revenue';

  // Chart data (will be used with Chart.js)
  revenueChartData: any = null;
  categoryChartData: any = null;

  constructor(private financialService: FinancialService) {
    // Set default date range to current month
    const dateRange = this.financialService.getDateRange('month');
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  /**
   * Load all financial data
   */
  loadAllData(): void {
    this.loadRevenueReport();
    this.loadSalesAnalytics();
    this.loadProfitLoss();
    this.loadTaxSummary();
  }

  /**
   * Load revenue report
   */
  loadRevenueReport(): void {
    this.loading.revenue = true;
    this.financialService.getRevenueReport(this.selectedPeriod, this.startDate, this.endDate)
      .subscribe({
        next: (data) => {
          this.revenueReport = data;
          this.loading.revenue = false;
        },
        error: (err) => {
          console.error('Error loading revenue report:', err);
          this.loading.revenue = false;
        }
      });
  }

  /**
   * Load sales analytics
   */
  loadSalesAnalytics(): void {
    this.loading.analytics = true;
    this.financialService.getSalesAnalytics(this.selectedPeriod, this.startDate, this.endDate)
      .subscribe({
        next: (data) => {
          this.salesAnalytics = data;
          this.prepareChartData(data);
          this.loading.analytics = false;
        },
        error: (err) => {
          console.error('Error loading sales analytics:', err);
          this.loading.analytics = false;
        }
      });
  }

  /**
   * Load profit/loss statement
   */
  loadProfitLoss(): void {
    this.loading.profitLoss = true;
    this.financialService.getProfitLoss(this.startDate, this.endDate)
      .subscribe({
        next: (data) => {
          this.profitLoss = data;
          this.loading.profitLoss = false;
        },
        error: (err) => {
          console.error('Error loading profit/loss:', err);
          this.loading.profitLoss = false;
        }
      });
  }

  /**
   * Load tax summary
   */
  loadTaxSummary(): void {
    this.loading.tax = true;
    this.financialService.getTaxSummary(this.selectedPeriod, this.startDate, this.endDate)
      .subscribe({
        next: (data) => {
          this.taxSummary = data;
          this.loading.tax = false;
        },
        error: (err) => {
          console.error('Error loading tax summary:', err);
          this.loading.tax = false;
        }
      });
  }

  /**
   * Prepare chart data from analytics
   */
  prepareChartData(analytics: SalesAnalyticsResponse): void {
    // Revenue trend chart data
    this.revenueChartData = {
      labels: analytics.chartData.labels,
      datasets: [
        {
          label: 'Revenue',
          data: analytics.chartData.revenue,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        },
        {
          label: 'Profit',
          data: analytics.chartData.profit,
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: analytics.chartData.expenses,
          borderColor: '#FF9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          tension: 0.4
        }
      ]
    };

    // Category breakdown pie chart data
    this.categoryChartData = {
      labels: analytics.categoryBreakdown.map(c => c.category),
      datasets: [{
        data: analytics.categoryBreakdown.map(c => c.revenue),
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FF9800',
          '#9C27B0',
          '#F44336'
        ]
      }]
    };
  }

  /**
   * Handle quick filter change
   */
  onQuickFilterChange(): void {
    if (this.quickFilter !== 'custom') {
      const dateRange = this.financialService.getDateRange(this.quickFilter);
      this.startDate = dateRange.startDate;
      this.endDate = dateRange.endDate;
      this.loadAllData();
    }
  }

  /**
   * Handle period change
   */
  onPeriodChange(): void {
    this.loadAllData();
  }

  /**
   * Handle custom date range change
   */
  onDateRangeChange(): void {
    this.quickFilter = 'custom';
    this.loadAllData();
  }

  /**
   * Export as Excel
   */
  exportExcel(): void {
    this.financialService.exportExcel(this.selectedPeriod, this.startDate, this.endDate)
      .subscribe({
        next: (blob) => {
          const filename = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`;
          this.financialService.downloadFile(blob, filename);
        },
        error: (err) => {
          console.error('Error exporting Excel:', err);
          alert('Failed to export Excel file');
        }
      });
  }

  /**
   * Export as PDF
   */
  exportPDF(): void {
    this.financialService.exportPDF(this.selectedPeriod, this.startDate, this.endDate)
      .subscribe({
        next: (blob) => {
          const filename = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
          this.financialService.downloadFile(blob, filename);
        },
        error: (err) => {
          console.error('Error exporting PDF:', err);
          alert('Failed to export PDF file');
        }
      });
  }

  /**
   * Sync orders to financial records
   */
  syncOrders(): void {
    if (confirm('This will sync all delivered orders to financial records. Continue?')) {
      this.financialService.syncOrders(this.startDate, this.endDate, 10)
        .subscribe({
          next: (response) => {
            alert(`Successfully synced ${response.synced} orders`);
            this.loadAllData();
          },
          error: (err) => {
            console.error('Error syncing orders:', err);
            alert('Failed to sync orders');
          }
        });
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return this.financialService.formatCurrency(amount);
  }

  /**
   * Get profit color class
   */
  getProfitClass(profit: number): string {
    return profit >= 0 ? 'profit-positive' : 'profit-negative';
  }

  /**
   * Switch active tab
   */
  setActiveTab(tab: 'revenue' | 'analytics' | 'profitLoss' | 'tax'): void {
    this.activeTab = tab;
  }
}

