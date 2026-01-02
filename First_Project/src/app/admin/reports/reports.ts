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
  ) {}

  exportProductsCsv() {
    this.isExporting = true;
    this.toast.info('Generating CSV export...');
    
    this.apiService.exportProductsCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
        this.toast.success('Products CSV exported successfully!');
      },
      error: (err) => {
        console.error('CSV export failed', err);
        this.isExporting = false;
        this.toast.error('Failed to export CSV. Please try again.');
      }
    });
  }
}
