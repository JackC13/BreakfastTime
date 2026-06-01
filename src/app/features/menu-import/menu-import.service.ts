import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ExtractedItem {
  name:         string;
  price:        number | null;
  category:     string;
  desc?:        string;
  needs_review: boolean;
}

export interface ExtractionResponse {
  source: 'image' | 'website' | 'delivery';
  items:  ExtractedItem[];
}

@Injectable({ providedIn: 'root' })
export class MenuImportService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3001/api/extract';

  async fromImage(file: File): Promise<ExtractionResponse> {
    const form = new FormData();
    form.append('image', file);
    return firstValueFrom(this.http.post<ExtractionResponse>(`${this.base}/image`, form));
  }

  async fromUrl(url: string): Promise<ExtractionResponse> {
    return firstValueFrom(this.http.post<ExtractionResponse>(`${this.base}/url`, { url }));
  }
}
