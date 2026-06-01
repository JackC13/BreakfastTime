import { Component, inject, signal, computed, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuImportService, ExtractedItem, ExtractionResponse } from './menu-import.service';
import { ExtractionReviewComponent } from './components/extraction-review/extraction-review.component';
import { MenuDataService } from '../../core/services/menu-data.service';
import { Store, MenuItem } from '../../core/models/menu.model';

type Tab    = 'image' | 'url';
type Status = 'idle' | 'loading' | 'review' | 'destination' | 'merge' | 'error';

interface MergeItem {
  name:           string;
  category:       string;
  importedPrice:  number | null;
  existingPrice:  number | null;
  status:         'new' | 'changed' | 'unchanged' | 'removed';
  apply:          boolean;
}

@Component({
  selector: 'app-menu-import',
  standalone: true,
  imports: [FormsModule, ExtractionReviewComponent],
  template: `
    <div class="import-overlay" (click)="onOverlayClick($event)">
      <div class="import-sheet">
        <div class="import-header">
          <h3>{{ headerTitle() }}</h3>
          <button class="import-close" (click)="close.emit()">✕</button>
        </div>

        <!-- 來源選擇 / 提取 / 錯誤 -->
        @if (status() !== 'review' && status() !== 'destination' && status() !== 'merge') {
          <div class="import-tabs">
            <button class="import-tab" [class.active]="tab() === 'image'" (click)="tab.set('image')">📷 圖片</button>
            <button class="import-tab" [class.active]="tab() === 'url'"   (click)="tab.set('url')">🔗 網址</button>
          </div>

          @if (tab() === 'image') {
            <div class="dropzone"
              [class.dragover]="dragover()"
              (dragover)="$event.preventDefault(); dragover.set(true)"
              (dragleave)="dragover.set(false)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()">
              @if (preview()) {
                <img [src]="preview()" class="dropzone-preview" alt="預覽" />
              } @else {
                <div class="dropzone-hint">
                  <span class="dropzone-icon">📷</span>
                  <p>點擊或拖曳菜單圖片</p>
                  <p class="dropzone-sub">支援 JPG、PNG、WEBP，最大 10MB</p>
                </div>
              }
            </div>
            <input #fileInput type="file" accept="image/*" hidden (change)="onFileChange($event)" />
            @if (selectedFile()) {
              <button class="btn-primary full" [disabled]="status() === 'loading'" (click)="extractImage()">
                {{ status() === 'loading' ? '提取中…' : '開始提取' }}
              </button>
            }
          }

          @if (tab() === 'url') {
            <div class="url-input-group">
              <input class="url-input" type="url" [(ngModel)]="url"
                placeholder="貼上店家或外送平台網址" />
              <button class="btn-primary" [disabled]="!url || status() === 'loading'" (click)="extractUrl()">
                {{ status() === 'loading' ? '提取中…' : '提取' }}
              </button>
            </div>
            <p class="url-hint">支援：店家官網、UberEats、Foodpanda</p>
          }

          @if (status() === 'error') {
            <div class="import-error">{{ errorMsg() }}</div>
          }

          @if (status() === 'loading') {
            <div class="import-loading">
              <div class="spinner"></div>
              <p>AI 正在分析菜單…</p>
            </div>
          }
        }

        <!-- Review 提取結果 -->
        @if (status() === 'review' && result()) {
          <div class="source-badge-row">
            來源：<span class="source-badge">{{ sourceLabel() }}</span>
          </div>
          <app-extraction-review
            [items]="result()!.items"
            (confirm)="onConfirmReview($event)"
            (cancel)="reset()" />
        }

        <!-- 選擇目的地 -->
        @if (status() === 'destination') {
          <div class="destination-body">
            <div class="destination-section">
              <h4>建立新店家</h4>
              <div class="destination-new">
                <input class="destination-input" [(ngModel)]="newStoreName"
                  placeholder="輸入店家名稱" (keyup.enter)="createNewStore()" />
                <button class="btn-primary" [disabled]="!newStoreName.trim()" (click)="createNewStore()">建立</button>
                <button class="btn-secondary" [disabled]="!newStoreName.trim()" (click)="exportJson()" title="下載 JSON 檔">⬇ JSON</button>
              </div>
            </div>
            <div class="destination-section">
              <h4>更新現有店家</h4>
              <div class="destination-stores">
                @for (store of stores(); track store.id) {
                  <button class="destination-store-btn" (click)="selectForMerge(store)">
                    <span>{{ store.name }}</span>
                    <span class="destination-store-badge">{{ store.badge }}</span>
                  </button>
                }
              </div>
            </div>
          </div>
        }

        <!-- 比對 Merge -->
        @if (status() === 'merge' && targetStore()) {
          <div class="merge-body">
            <div class="merge-info">與「{{ targetStore()!.name }}」比對，共 {{ confirmedItems().length }} 項匯入</div>
            <div class="merge-list">
              @if (newMergeItems().length) {
                <div class="merge-section">
                  <div class="merge-section-title new">➕ 新增品項（{{ newMergeItems().length }}）</div>
                  @for (item of newMergeItems(); track item.name) {
                    <label class="merge-item">
                      <input type="checkbox" [(ngModel)]="item.apply" />
                      <span class="merge-name">{{ item.name }}</span>
                      <span class="merge-cat">{{ item.category }}</span>
                      <span class="merge-price">{{ '$' + (item.importedPrice ?? '—') }}</span>
                    </label>
                  }
                </div>
              }
              @if (changedMergeItems().length) {
                <div class="merge-section">
                  <div class="merge-section-title changed">🔄 價格變動（{{ changedMergeItems().length }}）</div>
                  @for (item of changedMergeItems(); track item.name) {
                    <label class="merge-item">
                      <input type="checkbox" [(ngModel)]="item.apply" />
                      <span class="merge-name">{{ item.name }}</span>
                      <span class="merge-price-change">{{ '$' + item.existingPrice + ' → $' + item.importedPrice }}</span>
                    </label>
                  }
                </div>
              }
              @if (removedMergeItems().length) {
                <div class="merge-section">
                  <div class="merge-section-title removed">❌ 已下架品項（{{ removedMergeItems().length }}）</div>
                  @for (item of removedMergeItems(); track item.name) {
                    <label class="merge-item">
                      <input type="checkbox" [(ngModel)]="item.apply" />
                      <span class="merge-name">{{ item.name }}</span>
                      <span class="merge-cat">{{ item.category }}</span>
                      <span class="merge-price">{{ '$' + (item.existingPrice ?? '—') }}</span>
                    </label>
                  }
                </div>
              }
              @if (unchangedMergeItems().length) {
                <div class="merge-section unchanged-section">
                  <div class="merge-section-title unchanged">✅ 相同品項（{{ unchangedMergeItems().length }}）</div>
                </div>
              }
            </div>
            <div class="merge-actions">
              <button class="btn-secondary" (click)="status.set('destination')">返回</button>
              <button class="btn-primary" (click)="confirmMerge()">套用變更</button>
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class MenuImportComponent {
  close    = output<void>();
  imported = output<string>();  // emits storeId

  private svc      = inject(MenuImportService);
  private menuData = inject(MenuDataService);

  tab          = signal<Tab>('image');
  status       = signal<Status>('idle');
  dragover     = signal(false);
  preview      = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  url          = '';
  result       = signal<ExtractionResponse | null>(null);
  errorMsg     = signal('');

  confirmedItems = signal<ExtractedItem[]>([]);
  newStoreName   = '';
  stores         = this.menuData.stores;
  targetStore    = signal<Store | null>(null);
  mergeItems     = signal<MergeItem[]>([]);

  newMergeItems       = computed(() => this.mergeItems().filter(i => i.status === 'new'));
  changedMergeItems   = computed(() => this.mergeItems().filter(i => i.status === 'changed'));
  unchangedMergeItems = computed(() => this.mergeItems().filter(i => i.status === 'unchanged'));
  removedMergeItems   = computed(() => this.mergeItems().filter(i => i.status === 'removed'));

  headerTitle = computed(() => {
    const map: Record<Status, string> = {
      idle: '匯入菜單', loading: '匯入菜單', error: '匯入菜單',
      review: '確認品項', destination: '選擇目的地', merge: '比對品項',
    };
    return map[this.status()];
  });

  sourceLabel = () => ({ image: '圖片', website: '店家網站', delivery: '外送平台' })[this.result()?.source ?? 'image'];

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('import-overlay')) this.close.emit();
  }

  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) this.setFile(file);
  }

  private setFile(file: File): void {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.preview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  async extractImage(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;
    this.status.set('loading');
    try {
      const res = await this.svc.fromImage(file);
      this.result.set(res);
      this.status.set('review');
    } catch (e: any) {
      this.errorMsg.set(e?.error?.error ?? '無法連線到後端，請確認 server 是否啟動。');
      this.status.set('error');
    }
  }

  async extractUrl(): Promise<void> {
    if (!this.url) return;
    this.status.set('loading');
    try {
      const res = await this.svc.fromUrl(this.url);
      this.result.set(res);
      this.status.set('review');
    } catch (e: any) {
      this.errorMsg.set(e?.error?.error ?? '無法連線到後端，請確認 server 是否啟動。');
      this.status.set('error');
    }
  }

  onConfirmReview(items: ExtractedItem[]): void {
    this.confirmedItems.set(items);
    this.newStoreName = '';
    this.status.set('destination');
  }

  createNewStore(): void {
    const name = this.newStoreName.trim();
    if (!name) return;
    const menu = this.groupByCategory(this.confirmedItems());
    const id   = 'imported_' + Date.now();
    this.menuData.addStore({ id, name, badge: '匯入', address: '—', hours: '—', menu });
    this.imported.emit(id);
  }

  selectForMerge(store: Store): void {
    this.targetStore.set(store);
    this.buildMergeItems(store);
    this.status.set('merge');
  }

  private buildMergeItems(store: Store): void {
    const confirmed = this.confirmedItems();

    const existingMap = new Map<string, { price: number; category: string }>();
    for (const [cat, items] of Object.entries(store.menu)) {
      for (const item of items) existingMap.set(item.name, { price: item.price, category: cat });
    }

    const importedNames = new Set(confirmed.map(i => i.name));
    const result: MergeItem[] = [];

    for (const item of confirmed) {
      const existing = existingMap.get(item.name);
      if (!existing) {
        result.push({ name: item.name, category: item.category, importedPrice: item.price, existingPrice: null, status: 'new', apply: true });
      } else if (existing.price !== item.price) {
        result.push({ name: item.name, category: existing.category, importedPrice: item.price, existingPrice: existing.price, status: 'changed', apply: true });
      } else {
        result.push({ name: item.name, category: existing.category, importedPrice: item.price, existingPrice: existing.price, status: 'unchanged', apply: false });
      }
    }

    for (const [name, info] of existingMap) {
      if (!importedNames.has(name)) {
        result.push({ name, category: info.category, importedPrice: null, existingPrice: info.price, status: 'removed', apply: false });
      }
    }

    this.mergeItems.set(result);
  }

  confirmMerge(): void {
    const store = this.targetStore();
    if (!store) return;

    const newMenu: Record<string, MenuItem[]> = JSON.parse(JSON.stringify(store.menu));

    for (const change of this.mergeItems().filter(i => i.apply)) {
      if (change.status === 'new') {
        const cat = change.category || '其他';
        if (!newMenu[cat]) newMenu[cat] = [];
        newMenu[cat].push({ name: change.name, price: change.importedPrice ?? 0 });
      } else if (change.status === 'changed') {
        for (const cat of Object.keys(newMenu)) {
          const idx = newMenu[cat].findIndex(i => i.name === change.name);
          if (idx >= 0) { newMenu[cat][idx] = { ...newMenu[cat][idx], price: change.importedPrice ?? newMenu[cat][idx].price }; break; }
        }
      } else if (change.status === 'removed') {
        for (const cat of Object.keys(newMenu)) {
          const idx = newMenu[cat].findIndex(i => i.name === change.name);
          if (idx >= 0) {
            newMenu[cat].splice(idx, 1);
            if (newMenu[cat].length === 0) delete newMenu[cat];
            break;
          }
        }
      }
    }

    this.menuData.updateStoreMenu(store.id, newMenu);
    this.imported.emit(store.id);
  }

  private groupByCategory(items: ExtractedItem[]): Record<string, MenuItem[]> {
    const menu: Record<string, MenuItem[]> = {};
    for (const item of items) {
      const cat = item.category || '其他';
      if (!menu[cat]) menu[cat] = [];
      menu[cat].push({ name: item.name, price: item.price ?? 0, desc: item.desc ?? undefined });
    }
    return menu;
  }

  exportJson(): void {
    const name = this.newStoreName.trim();
    if (!name) return;
    const store: Store = {
      id: 'imported_' + Date.now(),
      name,
      badge: '匯入',
      address: '—',
      hours: '—',
      menu: this.groupByCategory(this.confirmedItems()),
    };
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  reset(): void {
    this.status.set('idle');
    this.result.set(null);
    this.preview.set(null);
    this.selectedFile.set(null);
    this.url = '';
    this.confirmedItems.set([]);
    this.newStoreName = '';
    this.targetStore.set(null);
    this.mergeItems.set([]);
  }
}
