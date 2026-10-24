import { readFileSync } from 'node:fs';
const src = readFileSync('lib/ingest.ts','utf8');
// quick standalone parse test against the real feed using the same logic
const FEED='https://rss.politico.com/congress.xml';
const res = await fetch(FEED);
console.log('HTTP', res.status);
const xml = await res.text();
const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
console.log('items found:', items.length);
const first = items[0]?.[1] ?? '';
const title = (first.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'\').trim();
const link = (first.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1]||'').trim();
console.log('first title:', title.slice(0,80));
console.log('first link:', link.slice(0,80));
