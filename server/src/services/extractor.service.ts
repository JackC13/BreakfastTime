import { GoogleGenAI } from '@google/genai';
import { MenuItemSchema, MenuItem } from '../models/menu';

const apiKey = process.env['GEMINI_API_KEY'];
if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY 未設定，提取功能將無法使用');
}
const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });

const SYSTEM_PROMPT = `你是一個菜單資料提取專家。
請從輸入內容中提取所有餐點，輸出純 JSON 陣列，不要任何說明文字。

規則：
1. 只提取內容中明確出現的品項
2. 價格無法辨識時填 null
3. 無法確定分類時填「其他」
4. 禁止推測或補充來源以外的資訊
5. 輸出格式如下（只輸出 JSON）：
[
  {
    "name": "里肌豬排蛋餅",
    "price": 60,
    "category": "蛋餅系列",
    "desc": "選填，品項描述",
    "needs_review": false
  }
]`;

function extractJson(raw: string): unknown {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('LLM 回應中找不到 JSON 陣列');
  return JSON.parse(match[0]);
}

function parseItems(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw)) throw new Error('JSON 不是陣列');
  return raw.map((item, i) => {
    const result = MenuItemSchema.safeParse(item);
    if (!result.success) {
      console.warn(`第 ${i + 1} 項解析失敗，標記 needs_review`, result.error.issues);
      return MenuItemSchema.parse({ ...item, needs_review: true });
    }
    return result.data;
  });
}

export async function extractFromImage(base64: string, mimeType: string): Promise<MenuItem[]> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT + '\n\n請提取這張菜單圖片中的所有餐點。' },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
  });

  const raw = response.text ?? '';
  return parseItems(extractJson(raw));
}

export async function extractFromText(text: string, source: 'website' | 'delivery'): Promise<MenuItem[]> {
  const label = source === 'website' ? '店家網頁' : '外送平台頁面';
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n以下是${label}的文字內容，請提取所有餐點：\n\n${text.slice(0, 12000)}` }],
      },
    ],
  });

  const raw = response.text ?? '';
  return parseItems(extractJson(raw));
}
