const FEED = "https://rss.politico.com/congress.xml";
const res = await fetch(FEED);
console.log("HTTP", res.status);
const xml = await res.text();
const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
console.log("items found:", items.length);

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

for (const it of items.slice(0, 3)) {
  const b = it[1];
  console.log("---");
  console.log("title:", tag(b, "title").slice(0, 90));
  console.log("link :", tag(b, "link").slice(0, 90));
  console.log("date :", tag(b, "pubDate"));
}
