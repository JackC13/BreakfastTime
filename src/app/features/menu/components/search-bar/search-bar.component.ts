import { Component, output, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-bar-wrapper">
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" [(ngModel)]="query" (ngModelChange)="queryChange.emit($event)"
          placeholder="搜尋餐點名稱..." autocomplete="off" />
        @if (query()) {
          <button class="search-clear" (click)="clear()">✕</button>
        }
      </div>
    </div>
  `,
})
export class SearchBarComponent {
  query = model('');
  queryChange = output<string>();

  clear(): void {
    this.query.set('');
    this.queryChange.emit('');
  }
}
