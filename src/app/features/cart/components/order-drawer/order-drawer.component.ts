import { Component, inject, output, signal, ElementRef, AfterViewInit } from '@angular/core';
import { CartService } from '../../cart.service';
import { MenuDataService } from '../../../../core/services/menu-data.service';
import { CartItem } from '../../../../core/models/menu.model';

@Component({
  selector: 'app-order-drawer',
  standalone: true,
  template: `
    <div class="order-overlay open" (click)="close.emit()"></div>
    <aside class="order-sheet open" #sheet>
      <div class="order-sheet-handle"></div>
      <div class="order-sheet-header">
        <h3>我的選單</h3>
        <button class="order-clear-btn" [class.confirming]="confirming()" (click)="clearAll()">
          {{ confirming() ? '確定清除？' : '清除全部' }}
        </button>
      </div>

      <div class="order-sheet-body">
        @if (cart.items().length === 0) {
          <p class="order-empty">尚未選擇任何餐點</p>
        } @else {
          @for (group of groupedItems; track group.storeId) {
            <div class="order-section">
              <div class="order-section-header">
                <span class="store-badge" [class]="group.storeId">{{ group.storeName }}</span>
                <span class="order-sub">{{ "$" + group.subtotal }}</span>
              </div>
              @for (item of group.items; track item.name) {
                <div class="order-row">
                  <div class="order-row-left">
                    <span class="order-row-name">{{ item.name }}</span>
                    <input class="order-note-input" placeholder="備註（如：不要蔥）"
                      [value]="item.note ?? ''"
                      (input)="cart.updateNote(item.storeId, item.name, $any($event.target).value)" />
                  </div>
                  <div class="order-row-right">
                    <div class="qty-control order-qty">
                      <button class="qty-btn" (click)="cart.changeQty(item.storeId, item.name, -1)">－</button>
                      <span class="qty-num">{{ item.qty }}</span>
                      <button class="qty-btn qty-add" (click)="cart.changeQty(item.storeId, item.name, 1)">＋</button>
                    </div>
                    <span class="order-row-price">{{ "$" + item.price * item.qty }}</span>
                  </div>
                </div>
              }
            </div>
          }
          <div class="order-grand">合計 <strong>{{ "$" + cart.totalPrice() }}</strong></div>
        }
      </div>

      <div class="order-sheet-footer">
        <button class="line-share-btn" [disabled]="cart.totalQty() === 0" (click)="shareToLine()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          分享到 LINE
        </button>
      </div>
    </aside>
  `,
})
export class OrderDrawerComponent implements AfterViewInit {
  cart = inject(CartService);
  private menuData = inject(MenuDataService);
  close = output<void>();

  confirming = signal(false);
  private clearTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    // swipe to dismiss
    const sheet = (this as any).el?.nativeElement?.querySelector('aside');
    if (!sheet) return;
    let startY = 0;
    sheet.addEventListener('touchstart', (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sheet.style.transform = `translateX(-50%) translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', (e: TouchEvent) => {
      sheet.style.transition = '';
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) this.close.emit();
      else sheet.style.transform = '';
    });
  }

  get groupedItems(): Array<{ storeId: string; storeName: string; items: CartItem[]; subtotal: number }> {
    const storeOrder = this.menuData.stores().map((s: { id: string }) => s.id);
    const map = new Map<string, { storeId: string; storeName: string; items: CartItem[]; subtotal: number }>();
    for (const item of this.cart.items()) {
      if (!map.has(item.storeId)) {
        map.set(item.storeId, { storeId: item.storeId, storeName: item.storeName, items: [], subtotal: 0 });
      }
      const g = map.get(item.storeId)!;
      g.items.push(item);
      g.subtotal += item.price * item.qty;
    }
    return storeOrder.filter(id => map.has(id)).map(id => map.get(id)!);
  }

  clearAll(): void {
    if (!this.confirming()) {
      this.confirming.set(true);
      this.clearTimer = setTimeout(() => this.confirming.set(false), 2500);
      return;
    }
    clearTimeout(this.clearTimer);
    this.confirming.set(false);
    this.cart.clear();
  }

  shareToLine(): void {
    const groups = this.groupedItems;
    let text = '🍳 早餐選單\n';
    for (const g of groups) {
      text += `\n【${g.storeName}】\n`;
      for (const i of g.items) {
        text += `・${i.name}`;
        if (i.qty > 1) text += ` x${i.qty}`;
        text += `  $${i.price * i.qty}`;
        if (i.note) text += `（${i.note}）`;
        text += '\n';
      }
    }
    text += `\n合計 $${this.cart.totalPrice()}`;
    window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
  }
}
