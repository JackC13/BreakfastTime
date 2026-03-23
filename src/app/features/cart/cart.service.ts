import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../../core/models/menu.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items = this._items.asReadonly();
  readonly totalQty = computed(() => this._items().reduce((s, i) => s + i.qty, 0));
  readonly totalPrice = computed(() => this._items().reduce((s, i) => s + i.price * i.qty, 0));

  getQty(storeId: string, name: string): number {
    return this._items().find(i => i.storeId === storeId && i.name === name)?.qty ?? 0;
  }

  toggle(storeId: string, storeName: string, name: string, price: number): void {
    const exists = this._items().some(i => i.storeId === storeId && i.name === name);
    if (exists) {
      this._items.update(items => items.filter(i => !(i.storeId === storeId && i.name === name)));
    } else {
      this._items.update(items => [...items, { storeId, storeName, name, price, qty: 1 }]);
    }
  }

  changeQty(storeId: string, name: string, delta: number): void {
    this._items.update(items =>
      items
        .map(i => i.storeId === storeId && i.name === name ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
    );
  }

  updateNote(storeId: string, name: string, note: string): void {
    this._items.update(items =>
      items.map(i => i.storeId === storeId && i.name === name ? { ...i, note } : i)
    );
  }

  clear(): void {
    this._items.set([]);
  }
}
