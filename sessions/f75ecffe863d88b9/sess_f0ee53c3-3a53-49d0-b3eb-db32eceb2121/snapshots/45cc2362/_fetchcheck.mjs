const feed = await (await fetch("https://rss.politico.com/congress.xml")).text();
const links = [...feed.matchAll(/<item\b[^>]*>[\s\S]*?<link>([\s\S]*?)<\/link>/gi)].map((m) => m[1].trim()).slice(0, 3);
for (const url of links) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapachusettsBot/0.1)" },
    });
    const html = await res.text();
    const ld = /"articleBody"\s*:\s*"/.test(html);
    const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].length;
    console.log(res.status, "len", html.length, "jsonld-body", ld, "paras", paras, url.slice(0, 80));
  } catch (e) {
    console.log("ERR", url, String(e));
  }
}
