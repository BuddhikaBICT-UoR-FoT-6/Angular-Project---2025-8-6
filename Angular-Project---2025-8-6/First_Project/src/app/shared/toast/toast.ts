import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastMessage, ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class Toast implements OnInit, OnDestroy {
  // Active toasts rendered on the screen.
  toasts: ToastMessage[] = [];

  private subscription?: Subscription;

  constructor(
    private toastService: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Subscribe to global toast stream.
    // Note: guard browser-only APIs (setTimeout/window) because this app supports SSR.
    this.subscription = this.toastService.toast$.subscribe((toast) => {
      this.toasts = [...this.toasts, toast];

      if (isPlatformBrowser(this.platformId)) {
        // Auto-dismiss after the configured duration.
        window.setTimeout(() => {
          this.dismiss(toast.id);
        }, toast.durationMs);
      }
    });
  }

  ngOnDestroy(): void {
    // Prevent memory leaks if the component is destroyed.
    this.subscription?.unsubscribe();
  }

  dismiss(id: string): void {
    // Remove toast from active list.
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  trackById(_index: number, toast: ToastMessage): string {
    return toast.id;
  }
}
