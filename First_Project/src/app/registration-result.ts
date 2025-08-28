import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-registration-result',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="result-container">
      <div class="result-card" [class.success]="isSuccess" [class.error]="!isSuccess">
        <div class="icon">
          <span *ngIf="isSuccess">✅</span>
          <span *ngIf="!isSuccess">❌</span>
        </div>
        <h2>{{isSuccess ? 'Registration Successful!' : 'Registration Failed'}}</h2>
        <p>{{message}}</p>
        
        <div class="actions">
          <button *ngIf="isSuccess" (click)="goToLogin()" class="btn primary">
            Go to Login
          </button>
          <button *ngIf="!isSuccess" (click)="goToRegister()" class="btn primary">
            Try Again
          </button>
          <a routerLink="/" class="btn secondary">Back to Home</a>
        </div>
        
        <p *ngIf="isSuccess" class="auto-redirect">
          You will be redirected to login in 5 seconds...
        </p>
      </div>
    </div>
  `,
  styles: [`
    .result-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 20px;
    }
    
    .result-card {
      background: white;
      padding: 3rem;
      border-radius: 15px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 500px;
      width: 100%;
    }
    
    .result-card.success {
      border-top: 5px solid #28a745;
    }
    
    .result-card.error {
      border-top: 5px solid #dc3545;
    }
    
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    
    h2 {
      color: #333;
      margin-bottom: 1rem;
    }
    
    p {
      color: #666;
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }
    
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.3s;
    }
    
    .btn.primary {
      background: #007bff;
      color: white;
    }
    
    .btn.primary:hover {
      background: #0056b3;
    }
    
    .btn.secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn.secondary:hover {
      background: #545b62;
    }
    
    .auto-redirect {
      font-size: 0.9rem;
      color: #28a745;
      margin-top: 1rem;
      font-style: italic;
    }
  `]
})
export class RegistrationResult implements OnInit {
  isSuccess = false;
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.isSuccess = params['success'] === 'true';
      this.message = params['message'] || 'Unknown result';
    });

    if (this.isSuccess) {
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 5000);
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}