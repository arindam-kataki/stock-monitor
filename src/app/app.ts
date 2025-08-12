// src/app/app.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from './shared/navigation/navigation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavigationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  title = 'stock-monitor';
  isSidebarCollapsed = false;

  ngOnInit(): void {
    // Load saved sidebar state
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      this.isSidebarCollapsed = saved === 'true';
    }
  }

  onSidebarToggled(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
