import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports {
  isExporting = false;

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) { }

  exportProductsCsv() {
    this.isExporting = true;
    this.toast.info('Generating CSV export...');

    this.apiService.exportProductsCsv().subscribe({
      next: (blob) => this.handleBlobDownload(blob, 'products.csv'),
      error: (err) => this.handleExportError(err)
    });
  }

  downloadReport(type: 'sales' | 'inventory' | 'customers', format: 'pdf' | 'excel') {
    this.isExporting = true;
    this.toast.info(`Generating ${type} report as ${format.toUpperCase()}...`);

    let request;
    if (type === 'sales') request = this.apiService.exportSalesReport(format);
    else if (type === 'inventory') request = this.apiService.exportInventoryReport(format);
    else request = this.apiService.exportCustomerReport(format);

    request.subscribe({
      next: (blob) => {
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        this.handleBlobDownload(blob, `${type}_report.${ext}`);
      },
      error: (err) => this.handleExportError(err)
    });
  }

  private handleBlobDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    this.isExporting = false;
    this.toast.success(`${filename} exported successfully!`);
  }

  private handleExportError(err: any) {
    console.error('Export failed', err);
    this.isExporting = false;
    this.toast.error('Failed to export report. Please try again.');
  }
}
