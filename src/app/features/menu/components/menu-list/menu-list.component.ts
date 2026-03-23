import { Component, input, inject } from '@angular/core';
import { Store, MenuItem } from '../../../../core/models/menu.model';
import { CartService } from '../../../cart/cart.service';

interface CategoryGroup {
  name: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-menu-list',
  standalone: true,
  template: `
    <main class="menu-container">
      @if (searchResultCount !== null) {
        <div class="search-result-info">找到 {{ searchResultCount }} 項餐點</div>
      }

      @if (visibleCategories.length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>找不到符合條件的餐點</p>
        </div>
      }

      @for (cat of visibleCategories; track cat.name) {
        <div class="section-title" [innerHTML]="highlight(cat.name, searchQuery())"></div>
        <div class="menu-list">
          @for (item of cat.items; track item.name) {
            @let qty = cart.getQty(store().id, item.name);
            <div class="menu-item fade-in"
              [class]="'store-' + store().id"
              [class.popular]="item.popular"
              [class.selected]="qty > 0"
              (click)="cart.toggle(store().id, store().name, item.name, item.price)">
              <div class="menu-item-info">
                <div class="menu-item-name" [innerHTML]="highlight(item.name, searchQuery())"></div>
                @if (item.desc) {
                  <div class="menu-item-desc">{{ item.desc }}</div>
                }
              </div>
              <div class="menu-item-price" [class]="store().id">{{ '$' + item.price }}</div>
              @if (qty > 1) {
                <span class="qty-badge">{{ qty }}</span>
              }
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class MenuListComponent {
  store = input.required<Store>();
  activeCategory = input.required<string>();
  popularOnly = input.required<boolean>();
  searchQuery = input('');

  cart = inject(CartService);

  get visibleCategories(): CategoryGroup[] {
    const cats = this.activeCategory() === 'all'
      ? Object.keys(this.store().menu)
      : [this.activeCategory()];
    const q = this.searchQuery().toLowerCase();
    const result: CategoryGroup[] = [];

    for (const name of cats) {
      let items = this.store().menu[name] ?? [];
      if (this.popularOnly()) items = items.filter(i => i.popular);
      if (q) {
        const catMatch = name.toLowerCase().includes(q);
        if (!catMatch) items = items.filter(i => i.name.toLowerCase().includes(q));
      }
      if ((this.searchQuery() || this.popularOnly()) && items.length === 0) continue;
      result.push({ name, items });
    }
    return result;
  }

  get searchResultCount(): number | null {
    if (!this.searchQuery() && !this.popularOnly()) return null;
    return this.visibleCategories.reduce((s, c) => s + c.items.length, 0);
  }

  highlight(text: string, query: string): string {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), m => `<span class="highlight">${m}</span>`);
  }
}
