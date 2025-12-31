import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ApiService } from '../../services/api.service';


@Component({
  selector: 'app-showroom',
  imports: [CommonModule, RouterLink],
  templateUrl: './showroom.html',
  styleUrl: './showroom.css'
})

export class Showroom implements OnInit {
  featuredProducts: any[] = [];
  categories = ['Shirts', 'Pants', 'Dresses', 'Accessories'];
  isLoading = true;

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(){
    this.apiService.getProducts().subscribe({
      next: (products) => {
        this.featuredProducts = products.slice(0, 8);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching products:', error);
        this.isLoading = false;
      }

    });
  }
}
