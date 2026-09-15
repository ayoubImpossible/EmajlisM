const axios = require('axios');
async function probe() {
  try {
    // Search for revue de presse post specifically
    const { data: posts } = await axios.get('https://intranet.csefrs.ma/wp-json/wp/v2/posts', { 
      params: { per_page: 5, search: 'revue', _embed: 'wp:featuredmedia' },
      timeout: 10000 
    });
    console.log('Revue search results:', posts.length);
    posts.forEach(p => {
      const media = p._embedded?.["wp:featuredmedia"]?.[0];
      const hasInlineImg = /<img/i.test(p.content?.rendered || "");
      console.log(`[${p.id}] ${(p.title?.rendered||"").substring(0,70)}`);
      console.log(`  date: ${p.date} | cats: ${(p.categories||[]).join(",")}`);
      console.log(`  featured: ${media?.source_url ? "YES" : "NO"}`);
      console.log(`  inline imgs: ${hasInlineImg}`);
      console.log(`  content length: ${(p.content?.rendered||"").length}`);
      // Show first 200 chars of content
      console.log(`  content: ${(p.content?.rendered||"").substring(0,200)}`);
      console.log("");
    });
  } catch(e) { console.log("Error:", e.message); }
}
probe();
