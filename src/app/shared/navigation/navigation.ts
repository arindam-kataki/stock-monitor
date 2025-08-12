// src/app/shared/navigation/navigation.ts
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
  ],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
})
export class NavigationComponent implements OnInit {
  isCollapsed = false;

  @Output() sidebarToggled = new EventEmitter<boolean>();

  navItems = [
    {
      path: '/watches',
      label: 'Watches',
      icon: 'visibility',
      description: 'Manage stock watches',
    },
    {
      path: '/display',
      label: 'Display',
      icon: 'tune',
      description: 'Display settings',
    },
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      description: 'Live dashboard',
    },
    {
      path: '/analytics',
      label: 'Analytics',
      icon: 'analytics',
      description: 'Stock analytics',
    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Load saved preference
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      this.isCollapsed = saved === 'true';
      this.sidebarToggled.emit(this.isCollapsed);
    }

    // Check screen size on init
    this.checkScreenSize();
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;

    // Save preference to localStorage
    localStorage.setItem('sidebarCollapsed', this.isCollapsed.toString());

    // Emit event for app component
    this.sidebarToggled.emit(this.isCollapsed);
  }

  checkScreenSize(): void {
    // Auto-collapse on mobile
    if (window.innerWidth < 768) {
      this.isCollapsed = true;
      this.sidebarToggled.emit(true);
    }
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  getTooltip(item: any): string {
    return this.isCollapsed ? item.label : '';
  }
}
