import { Router, Request, Response } from 'express';
import multer from 'multer';
import { extractFromImage, extractFromText } from '../services/extractor.service';
import { fetchPageText, detectSource } from '../services/fetcher.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/extract/image
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  if (!process.env['GEMINI_API_KEY']) {
    res.status(503).json({ error: 'API 金鑰未設定，請在 server/.env 填入 GEMINI_API_KEY' });
    return;
  }
  try {
    if (!req.file) { res.status(400).json({ error: '請上傳圖片' }); return; }
    const base64 = req.file.buffer.toString('base64');
    const items = await extractFromImage(base64, req.file.mimetype);
    res.json({ source: 'image', items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '圖片提取失敗，請確認圖片清晰度或稍後再試', detail: String(err) });
  }
});

// POST /api/extract/url  body: { url: string }
router.post('/url', async (req: Request, res: Response) => {
  if (!process.env['GEMINI_API_KEY']) {
    res.status(503).json({ error: 'API 金鑰未設定，請在 server/.env 填入 GEMINI_API_KEY' });
    return;
  }
  try {
    const { url } = req.body as { url?: string };
    if (!url) { res.status(400).json({ error: '請提供 url' }); return; }

    const source = detectSource(url);
    const text   = await fetchPageText(url);
    const items  = await extractFromText(text, source);
    res.json({ source, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'URL 提取失敗，請確認網址是否正確或可公開存取', detail: String(err) });
  }
});

export default router;
