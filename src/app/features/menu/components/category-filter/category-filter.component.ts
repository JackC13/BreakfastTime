import { Component, input, output, effect, ElementRef } from '@angular/core';

@Component({
  selector: 'app-category-filter',
  standalone: true,
  template: `
    <div class="filter-row">
      <nav class="category-filter">
        <button class="category-btn" [class.active]="activeCategory() === 'all'"
          (click)="categoryChange.emit('all')">全部</button>
        @for (cat of categories(); track cat) {
          <button class="category-btn" [class.active]="activeCategory() === cat"
            (click)="categoryChange.emit(cat)">
            {{ cat.replace(categoryPrefixRe, '') }}
          </button>
        }
        <button class="category-btn popular-btn" [class.active]="popularOnly()"
          (click)="popularToggle.emit()">🔥 人氣</button>
      </nav>
    </div>
  `,
})
export class CategoryFilterComponent {
  categories = input.required<string[]>();
  activeCategory = input.required<string>();
  popularOnly = input.required<boolean>();
  categoryChange = output<string>();
  popularToggle = output<void>();

  readonly categoryPrefixRe = /^[^\s]+\s/;

  constructor(private el: ElementRef) {
    effect(() => {
      const _ = this.activeCategory();
      setTimeout(() => {
        this.el.nativeElement.querySelector('.category-btn.active')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 50);
    });
  }
}
