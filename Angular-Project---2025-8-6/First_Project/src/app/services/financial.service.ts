import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RevenueReportData {
    period: string;
    revenue: number;
    cogs: number;
    expenses: number;
    tax: number;
    net_amount: number;
    transactions: number;
    profit: number;
    profit_margin: string;
}

export interface RevenueReportResponse {
    success: boolean;
    period: string;
    dateRange: { startDate?: string; endDate?: string };
    data: RevenueReportData[];
    summary: {
        totalRevenue: number;
        totalProfit: number;
        totalTax: number;
        totalTransactions: number;
    };
}

export interface SalesAnalyticsResponse {
    success: boolean;
    period: string;
    chartData: {
        labels: string[];
        revenue: number[];
        profit: number[];
        expenses: number[];
        tax: number[];
        transactions: number[];
    };
    categoryBreakdown: Array<{
        category: string;
        revenue: number;
        count: number;
    }>;
    totalRecords: number;
}

export interface ProfitLossResponse {
    success: boolean;
    dateRange: { startDate?: string; endDate?: string };
    statement: {
        revenue: {
            gross_revenue: number;
            discounts: number;
            net_revenue: number;
        };
        costs: {
            cost_of_goods_sold: number;
            operating_expenses: number;
            total_costs: number;
        };
        profit: {
            gross_profit: number;
            gross_profit_margin: string;
            operating_profit: number;
            tax: number;
            net_profit: number;
            net_profit_margin: string;
        };
    };
    transactionCount: number;
}

export interface TaxSummaryResponse {
    success: boolean;
    period: string;
    dateRange: { startDate?: string; endDate?: string };
    summary: {
        total_tax_collected: number;
        total_taxable_amount: number;
        average_tax_rate: string;
        transactions_count: number;
    };
    breakdown: Array<{
        period: string;
        tax_collected: number;
        revenue: number;
        transactions: number;
    }>;
}

@Injectable({
    providedIn: 'root'
})
export class FinancialService {
    private apiUrl = '/api/financial';

    constructor(private http: HttpClient) { }

    /**
     * Get revenue report
     */
    getRevenueReport(
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<RevenueReportResponse> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get<RevenueReportResponse>(`${this.apiUrl}/revenue-report`, { params });
    }

    /**
     * Get sales analytics for charts
     */
    getSalesAnalytics(
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<SalesAnalyticsResponse> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get<SalesAnalyticsResponse>(`${this.apiUrl}/sales-analytics`, { params });
    }

    /**
     * Get profit/loss statement
     */
    getProfitLoss(startDate?: string, endDate?: string): Observable<ProfitLossResponse> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get<ProfitLossResponse>(`${this.apiUrl}/profit-loss`, { params });
    }

    /**
     * Get tax summary
     */
    getTaxSummary(
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<TaxSummaryResponse> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get<TaxSummaryResponse>(`${this.apiUrl}/tax-summary`, { params });
    }

    /**
     * Export report as Excel
     */
    exportExcel(
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<Blob> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get(`${this.apiUrl}/export/excel`, {
            params,
            responseType: 'blob'
        });
    }

    /**
     * Export report as PDF
     */
    exportPDF(
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<Blob> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);

        return this.http.get(`${this.apiUrl}/export/pdf`, {
            params,
            responseType: 'blob'
        });
    }

    /**
     * Sync orders to financial records
     */
    syncOrders(startDate?: string, endDate?: string, taxRate: number = 10): Observable<any> {
        return this.http.post(`${this.apiUrl}/sync-orders`, {
            startDate,
            endDate,
            taxRate
        });
    }

    /**
     * Helper to download blob as file
     */
    downloadFile(blob: Blob, filename: string): void {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Format currency
     */
    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    /**
     * Get date range for quick filters
     */
    getDateRange(range: 'today' | 'week' | 'month' | 'quarter' | 'year'): { startDate: string; endDate: string } {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        let startDate: Date;

        switch (range) {
            case 'today':
                startDate = new Date(now);
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate
        };
    }
}
