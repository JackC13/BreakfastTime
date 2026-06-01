import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExtractedItem } from '../../menu-import.service';

@Component({
  selector: 'app-extraction-review',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="review-header">
      <div class="review-summary">
        共提取 <strong>{{ items().length }}</strong> 項
        @if (reviewCount() > 0) {
          ，其中 <span class="badge-review">{{ reviewCount() }} 項需確認</span>
        }
      </div>
      <div class="review-actions">
        <button class="btn-secondary" (click)="cancel.emit()">取消</button>
        <button class="btn-primary" [disabled]="items().length === 0" (click)="confirm.emit(editableItems())">
          加入菜單
        </button>
      </div>
    </div>

    <div class="review-list">
      @for (item of editableItems(); track $index) {
        <div class="review-item" [class.needs-review]="item.needs_review">
          @if (item.needs_review) {
            <span class="review-flag" title="低信心度，請確認">⚠️</span>
          }
          <div class="review-item-fields">
            <input class="review-input name" [(ngModel)]="item.name" placeholder="品項名稱" />
            <input class="review-input category" [(ngModel)]="item.category" placeholder="分類" />
            <input class="review-input price" type="number" [(ngModel)]="item.price" placeholder="價格" />
            <input class="review-input desc" [(ngModel)]="item.desc" placeholder="描述（選填）" />
          </div>
          <button class="review-remove" (click)="removeItem($index)">✕</button>
        </div>
      }
    </div>
  `,
})
export class ExtractionReviewComponent {
  items  = input.required<ExtractedItem[]>();
  confirm = output<ExtractedItem[]>();
  cancel  = output<void>();

  editableItems = signal<ExtractedItem[]>([]);
  reviewCount   = computed(() => this.editableItems().filter(i => i.needs_review).length);

  ngOnInit(): void {
    this.editableItems.set(this.items().map(i => ({ ...i })));
  }

  removeItem(index: number): void {
    this.editableItems.update(items => items.filter((_, i) => i !== index));
  }
}
