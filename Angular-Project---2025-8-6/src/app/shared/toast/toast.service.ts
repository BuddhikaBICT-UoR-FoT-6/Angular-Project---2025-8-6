import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  // Emits new toast messages. The toast container listens to this stream.
  private readonly toastSubject = new Subject<ToastMessage>();
  readonly toast$ = this.toastSubject.asObservable();

  // --- Public helpers (use these in components) ---
  success(message: string, durationMs = 3000) {
    this.emit('success', message, durationMs);
  }

  error(message: string, durationMs = 4000) {
    this.emit('error', message, durationMs);
  }

  info(message: string, durationMs = 3000) {
    this.emit('info', message, durationMs);
  }

  warning(message: string, durationMs = 3500) {
    this.emit('warning', message, durationMs);
  }

  // --- Internal: create + emit toast ---
  private emit(type: ToastType, message: string, durationMs: number) {
    // Use crypto.randomUUID when available; fall back to a simple unique-ish id.
    const cryptoObj: Crypto | undefined = (globalThis as any)?.crypto;
    this.toastSubject.next({
      id: cryptoObj?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      type,
      message,
      durationMs
    });
  }
}
