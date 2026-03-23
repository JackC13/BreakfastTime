import { Component, input, output } from '@angular/core';
import { Store } from '../../../../core/models/menu.model';

@Component({
  selector: 'app-store-tabs',
  standalone: true,
  template: `
    <nav class="store-tabs">
      @for (store of stores(); track store.id) {
        <button
          class="store-tab"
          [class.active]="store.id === activeStoreId()"
          [attr.data-store]="store.id"
          (click)="storeChange.emit(store.id)">
          {{ store.name }}
        </button>
      }
    </nav>
  `,
})
export class StoreTabsComponent {
  stores = input.required<Store[]>();
  activeStoreId = input.required<string>();
  storeChange = output<string>();
}
