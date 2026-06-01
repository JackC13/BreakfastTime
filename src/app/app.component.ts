import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { MenuDataService } from './core/services/menu-data.service';
import { StoreTabsComponent } from './features/menu/components/store-tabs/store-tabs.component';
import { SearchBarComponent } from './features/menu/components/search-bar/search-bar.component';
import { CategoryFilterComponent } from './features/menu/components/category-filter/category-filter.component';
import { MenuListComponent } from './features/menu/components/menu-list/menu-list.component';
import { OrderFabComponent } from './features/cart/components/order-fab/order-fab.component';
import { OrderDrawerComponent } from './features/cart/components/order-drawer/order-drawer.component';
import { MenuImportComponent } from './features/menu-import/menu-import.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StoreTabsComponent,
    SearchBarComponent,
    CategoryFilterComponent,
    MenuListComponent,
    OrderFabComponent,
    OrderDrawerComponent,
    MenuImportComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private menuData = inject(MenuDataService);

  readonly stores = this.menuData.stores;
  readonly activeStoreId = signal(this.menuData.stores()[0].id);
  readonly activeCategory = signal('all');
  readonly popularOnly = signal(false);
  readonly searchQuery = signal('');
  readonly orderOpen = signal(false);
  readonly importOpen = signal(false);
  readonly showScrollTop = signal(false);

  readonly activeStore = computed(() => this.stores().find(s => s.id === this.activeStoreId())!);
  readonly categories = computed(() => Object.keys(this.activeStore().menu));

  @HostListener('window:scroll')
  onScroll(): void {
    this.showScrollTop.set(window.scrollY > 300);
  }

  switchStore(storeId: string): void {
    this.activeStoreId.set(storeId);
    this.activeCategory.set('all');
    this.popularOnly.set(false);
    this.searchQuery.set('');
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onImport(storeId: string): void {
    this.switchStore(storeId);
  }
}
