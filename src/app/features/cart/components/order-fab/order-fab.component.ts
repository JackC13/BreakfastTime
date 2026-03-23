import { Component, inject, output } from '@angular/core';
import { CartService } from '../../cart.service';

@Component({
  selector: 'app-order-fab',
  standalone: true,
  template: `
    @if (cart.totalQty() > 0) {
      <button class="order-fab" (click)="open.emit()">
        🛒 <span class="order-fab-count">{{ '$' + cart.totalPrice() }}</span>
      </button>
    }
  `,
})
export class OrderFabComponent {
  cart = inject(CartService);
  open = output<void>();
}
