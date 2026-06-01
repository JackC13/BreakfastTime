import puppeteer from 'puppeteer';

type UrlSource = 'delivery' | 'website';

const DELIVERY_PATTERNS = [
  /ubereats\.com/i,
  /foodpanda\.com/i,
  /deliveroo\.com/i,
];

export function detectSource(url: string): UrlSource {
  return DELIVERY_PATTERNS.some(p => p.test(url)) ? 'delivery' : 'website';
}

export async function fetchPageText(url: string): Promise<string> {
  const source = detectSource(url);
  return source === 'delivery'
    ? fetchWithHeadless(url)
    : fetchWithFetch(url);
}

async function fetchWithFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)' },
  });
  if (!res.ok) throw new Error(`無法取得頁面：${res.status} ${url}`);
  const html = await res.text();
  return stripHtml(html);
}

async function fetchWithHeadless(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for initial content
    await page.waitForFunction(
      () => document.body.innerText.length > 3000,
      { timeout: 15000 }
    ).catch(() => {});

    // Scroll incrementally and collect visible text at each position
    // (handles virtual scroll where off-screen DOM nodes are removed)
    const chunks = await page.evaluate(async () => {
      const seen = new Set<string>();
      const collected: string[] = [];
      const step = 400;
      const pause = 600;

      const snapshot = () => {
        const t = document.body.innerText.trim();
        if (!seen.has(t)) { seen.add(t); collected.push(t); }
      };

      snapshot();
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline) {
        window.scrollBy(0, step);
        await new Promise(r => setTimeout(r, pause));
        snapshot();
        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) break;
      }
      return collected;
    });

    // Merge all chunks — union of lines seen across all snapshots
    const allLines = new Set<string>();
    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        const t = line.trim();
        if (t) allLines.add(t);
      }
    }
    return Array.from(allLines).join('\n');
  } finally {
    await browser.close();
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
