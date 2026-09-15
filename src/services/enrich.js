'use strict';

/**
 * Enrichissement des Ã©lÃ©ments de flux.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * GET /api/v1/emajlis/feed renvoie, pour chaque Ã©lÃ©ment :
 *     { id, metadata, comments, likes, topics, files }
 * c'est-Ã -dire les mÃ©tadonnÃ©es et les compteurs â€” mais NI TITRE, NI EXTRAIT.
 * Impossible de dessiner une carte avec Ã§a.
 *
 * La correction propre est cÃ´tÃ© module HumHub : y ajouter un bloc `preview`
 * (voir docs/EMajlis-Mobile-Backend-Gaps.md, BG-01). Tant que le serveur n'est
 * pas modifiÃ©, Express complÃ¨te lui-mÃªme chaque Ã©lÃ©ment en interrogeant
 * l'endpoint spÃ©cialisÃ© du type concernÃ©.
 *
 * Le coÃ»t est maÃ®trisÃ© par deux mÃ©canismes :
 *  - un cache mÃ©moire de 5 minutes par (modÃ¨le, identifiant) ;
 *  - une limite de 6 requÃªtes simultanÃ©es vers HumHub.
 * Une page de 20 Ã©lÃ©ments coÃ»te donc au plus 4 vagues de requÃªtes Ã  froid, et
 * quasiment rien une fois le cache chaud.
 *
 * COMPATIBILITÃ‰ ASCENDANTE
 * ------------------------
 * Si un Ã©lÃ©ment contient dÃ©jÃ  un bloc `preview` (module HumHub mis Ã  jour),
 * il est utilisÃ© tel quel et aucune requÃªte supplÃ©mentaire n'est Ã©mise.
 * Le jour oÃ¹ BG-01 est dÃ©ployÃ©, ce fichier devient inerte sans Ãªtre modifiÃ©.
 *
 * LIMITE CONNUE
 * -------------
 * Les modÃ¨les MajlissPost (Journal, 365 contenus) et ImportArticle (400) n'ont
 * AUCUN contrÃ´leur REST cÃ´tÃ© HumHub : ni titre ni corps ne sont rÃ©cupÃ©rables.
 * Ces Ã©lÃ©ments reÃ§oivent un titre gÃ©nÃ©rique et sont marquÃ©s
 * `needsServerSupport: true`. Seul BG-01 peut les traiter correctement.
 */

const { tryGet } = require('./humhub');
const { TtlCache, mapLimit } = require('./cache');
const axios = require('axios');

const previewCache = new TtlCache(5 * 60 * 1000, 3000);
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY) || 6;

// â”€â”€ WordPress source for ImportArticle / MajlissPost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// These article types have no HumHub REST endpoint. Their images and titles
// live in the WordPress site that the import_article module syncs from.
// The WP REST API is public (no auth required).
const WP_BASE = (process.env.WP_BASE_URL || 'https://intranet.csefrs.ma').replace(/\/+$/, '');
const WP_API  = `${WP_BASE}/wp-json/wp/v2`;
const wpCache = new TtlCache(10 * 60 * 1000, 1000); // 10 min, 1000 entries

/**
 * Fetch WordPress posts for a given date (YYYY-MM-DD) with featured media.
 * Returns an array sorted newest-first so the first result is the best match.
 */
async function fetchWpPostsByDate(isoDate) {
  if (!isoDate) return [];
  const day = isoDate.slice(0, 10);
  const key = `wp:date:${day}`;
  return wpCache.getOrSet(key, async () => {
    try {
      const after  = `${day}T00:00:00`;
      const before = `${day}T23:59:59`;
      const { data } = await axios.get(`${WP_API}/posts`, {
        params: { per_page: 10, after, before, _embed: 'wp:featuredmedia', orderby: 'date', order: 'desc' },
        timeout: 8000,
      });
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  });
}

// Track used WordPress posts to prevent duplicates
const usedWpPosts = new Map();

/**
 * Given a raw HumHub article item, fetch its title and featured image from WordPress.
 * Matches by created_at date â€” on any given day there are typically 1â€“3 articles.
 * Uses a position counter to match each article with a unique WordPress post
 * and prevents duplicates when filters are applied.
 */
async function fetchArticleFromWp(createdAt, humhubId) {
  if (!createdAt) return null;
  const posts = await fetchWpPostsByDate(createdAt);
  if (!posts.length) return null;
  
  const day = createdAt.slice(0, 10);
  const key = `wp:index:${day}`;
  
  // Get or initialize the index counter for this date
  if (!usedWpPosts.has(key)) {
    usedWpPosts.set(key, 0);
  }
  
  let index = usedWpPosts.get(key);
  // If we've already used all posts for this date, reset and start from the first
  if (index >= posts.length) {
    index = 0;
    usedWpPosts.set(key, 0);
  }
  
  const p = posts[index];
  usedWpPosts.set(key, index + 1);
  
  const media = p._embedded?.['wp:featuredmedia']?.[0];
  return {
    title: (p.title?.rendered || '').replace(/&#8211;/g, 'â€“').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim() || 'Article du Journal',
    excerpt: (p.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim().slice(0, 220),
    imageUrl: media?.source_url || null,
    externalUrl: p.link || null,
    wpId: p.id,
    extra: { wpId: p.id, wpUrl: p.link, humhubId },
  };
}

// â”€â”€ Types normalisÃ©s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TYPE_BY_MODEL = [
  ['driveManager\\models\\DriveFile', 'drive_file'],
  ['driveManager\\models\\DriveFolder', 'drive_folder'],
  ['calendar\\models\\CalendarEntry', 'calendar'],
  ['post\\models\\Post', 'post'],
  ['externalHtmlStream\\models\\MajlissPost', 'article'],
  ['import_article\\models\\ImportArticle', 'article'],
  ['custom_pages\\models\\CustomPage', 'page'],
  ['cfiles\\models\\File', 'cfile'],
  ['cfiles\\models\\Folder', 'cfolder'],
  ['tasks\\models\\Task', 'task'],
  ['polls\\models\\Poll', 'poll'],
  ['gallery\\models\\Media', 'media'],
  ['wiki\\models\\WikiPage', 'wiki'],
];

function normalizeType(objectModel = '') {
  for (const [needle, type] of TYPE_BY_MODEL) {
    if (objectModel.includes(needle)) return type;
  }
  return 'other';
}

// â”€â”€ Extraction de texte â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retire le balisage pour produire un extrait lisible. Ne sert JAMAIS au corps. */
function toPlainText(str, maxLength = 220) {
  if (!str) return '';
  return String(str)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // images markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')     // liens markdown -> libellÃ©
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')                    // balises HTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8230;|&hellip;/gi, '\u2026')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-+]\s/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Titre d'un texte libre : premier titre markdown, sinon premiÃ¨re phrase.
 * Les publications E-Majlis commencent trÃ¨s souvent par Â« ### ðŸ“° Titre Â».
 */
function titleFromText(str) {
  if (!str) return '';
  const heading = String(str).match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  if (heading) return toPlainText(heading[1], 160);

  const plain = toPlainText(str, 400);
  if (!plain) return '';
  const sentence = plain.match(/^(.{0,120}?[.!?â€¦])(\s|$)/);
  return (sentence ? sentence[1] : plain.slice(0, 120)).trim();
}

function imageFromText(str) {
  if (!str) return null;
  const md = String(str).match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  if (md) return md[1];
  const html = String(str).match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  return html ? html[1] : null;
}

/**
 * Extrait la premiÃ¨re URL d'image depuis le tableau files[] fourni par HumHub.
 * HumHub stocke les images jointes comme fichiers (mime_type image/*) avec un
 * champ `url` ou `download_url` absolu. Cette fonction est le seul moyen
 * d'obtenir l'image des posts qui utilisent la piÃ¨ce jointe plutÃ´t que
 * l'embed markdown, et des articles (MajlissPost) qui n'ont pas d'endpoint REST.
 */
function imageFromFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const IMAGE_MIME = /^image\//i;
  const IMAGE_EXT  = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
  for (const f of files) {
    const mime = f.mime_type || f.mimeType || '';
    const url  = f.url || f.download_url || f.downloadUrl || '';
    if (!url) continue;
    if (IMAGE_MIME.test(mime) || IMAGE_EXT.test(url)) return url;
  }
  return null;
}

/** Premier lien externe d'un texte â€” utilisÃ© par les billets Â« Revue de presse Â». */
function linkFromText(str) {
  if (!str) return null;
  const md = String(str).match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/);
  return md ? md[1] : null;
}

function humanSize(bytes) {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} Mo`;
  return `${(n / 1073741824).toFixed(1)} Go`;
}

// â”€â”€ Construction du preview par type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchPreview(type, objectId, token) {
  switch (type) {
    case 'post': {
      const p = await tryGet(`/post/${objectId}`, token);
      if (!p) return null;
      const raw = p.message || '';
      return {
        title: titleFromText(raw) || 'Publication',
        excerpt: toPlainText(raw),
        // Prefer an image embedded in the message, then fall back to attached files[].
        imageUrl: imageFromText(raw) || imageFromFiles(p.files),
        externalUrl: linkFromText(raw),
        extra: {},
      };
    }

    case 'calendar': {
      const e = await tryGet(`/calendar/entry/${objectId}`, token);
      if (!e) return null;
      return {
        title: e.title || 'Ã‰vÃ©nement',
        excerpt: toPlainText(e.description),
        imageUrl: null,
        extra: {
          startDatetime: e.start_datetime || null,
          endDatetime: e.end_datetime || null,
          allDay: !!e.all_day,
          location: e.location || '',
          participationMode: e.participation_mode ?? null,
        },
      };
    }

    case 'drive_file': {
      const d = await tryGet(`/emajlis/drive/file/${objectId}`, token);
      const f = d?.file;
      if (!f) return null;
      return {
        title: f.title || f.filename || 'Document',
        excerpt: toPlainText(f.description) || f.human_size || '',
        imageUrl: null,
        extra: {
          filename: f.filename,
          mimeType: f.mime_type,
          size: f.size,
          humanSize: f.human_size || humanSize(f.size),
          folderId: f.folder_id,
          downloadPath: `/api/drive/file/${objectId}/download`,
        },
      };
    }

    case 'drive_folder': {
      const d = await tryGet(`/emajlis/drive/folder/${objectId}`, token);
      const f = d?.folder;
      if (!f) return null;
      return {
        title: f.name || 'Dossier',
        excerpt: toPlainText(f.description),
        imageUrl: null,
        extra: { folderId: f.id, parentId: f.parent_id },
      };
    }

    case 'cfile': {
      const f = await tryGet(`/cfiles/file/${objectId}`, token);
      if (!f) return null;
      const file = f.file || f;
      return {
        title: file.title || file.file_name || file.name || 'Fichier',
        excerpt: toPlainText(file.description) || humanSize(file.size),
        imageUrl: null,
        extra: { mimeType: file.mime_type, size: file.size, humanSize: humanSize(file.size) },
      };
    }

    case 'cfolder': {
      const f = await tryGet(`/cfiles/folder/${objectId}`, token);
      if (!f) return null;
      const folder = f.folder || f;
      return {
        title: folder.title || folder.name || 'Dossier',
        excerpt: toPlainText(folder.description),
        imageUrl: null,
        extra: {},
      };
    }

    case 'page': {
      const p = await tryGet(`/custom-pages/page/${objectId}`, token);
      if (!p) return null;
      const page = p.page || p;
      return {
        title: page.title || 'Page',
        excerpt: toPlainText(page.abstract || page.page_content),
        imageUrl: null,
        extra: { pageType: page.type ?? null },
      };
    }

    case 'task': {
      const t = await tryGet(`/tasks/task/${objectId}`, token);
      if (!t) return null;
      const task = t.task || t;
      return {
        title: task.title || 'TÃ¢che',
        excerpt: toPlainText(task.description),
        imageUrl: null,
        extra: { status: task.status ?? null, endDatetime: task.end_datetime || null },
      };
    }

    case 'poll': {
      const p = await tryGet(`/polls/poll/${objectId}`, token);
      if (!p) return null;
      const poll = p.poll || p;
      return {
        title: poll.question || 'Sondage',
        excerpt: toPlainText(poll.description),
        imageUrl: null,
        extra: { closed: !!poll.closed, answerCount: poll.answers?.length ?? null },
      };
    }

    // MajlissPost, ImportArticle : no HumHub REST endpoint exists.
    // Images and titles come from the WordPress source (intranet.csefrs.ma).
    // Matched by created_at date via the WordPress REST API.
    case 'article':
      return null; // enrichItems handles this via fetchArticleFromWp()

    default:
      return null;
  }
}

const GENERIC_TITLE = {
  article: 'Article du Journal',
  media: 'MÃ©dia',
  wiki: 'Page wiki',
  other: 'Contenu',
};

// â”€â”€ API publique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Transforme un Ã©lÃ©ment brut de /emajlis/feed en Ã©lÃ©ment consommable par le
 * mobile. `metadata` est conservÃ© intact : la transformation est additive.
 */
function baseItem(raw) {
  const meta = raw.metadata || {};
  const type = normalizeType(meta.object_model || '');

  return {
    id: raw.id ?? meta.id ?? null,
    objectModel: meta.object_model || '',
    objectId: meta.object_id ?? null,
    type,
    title: '',
    excerpt: '',
    imageUrl: null,
    externalUrl: null,
    url: meta.url || '',
    createdAt: meta.created_at || null,
    updatedAt: meta.updated_at || null,
    author: meta.created_by
      ? {
          id: meta.created_by.id,
          name: meta.created_by.display_name || '',
          url: meta.created_by.url || '',
        }
      : null,
    containerId: meta.contentcontainer_id ?? null,
    pinned: !!meta.pinned,
    comments: { total: raw.comments?.total ?? 0 },
    likes: { total: raw.likes?.total ?? 0 },
    topics: raw.topics || [],
    files: raw.files || [],
    extra: {},
    needsServerSupport: false,
    metadata: meta,
  };
}

/**
 * @param {Array} rawItems Ã©lÃ©ments bruts de /emajlis/feed ou /emajlis/search
 * @param {string} token jeton HumHub de l'utilisateur
 * @returns {Promise<Array>} Ã©lÃ©ments enrichis
 */
async function enrichItems(rawItems, token) {
  // On filtre d'abord, puis on construit : les deux tableaux restent alignÃ©s
  // index par index, ce qui Ã©vite une recherche par identifiant.
  const sources = (rawItems || []).filter(Boolean);
  const items = sources.map(baseItem);

  await mapLimit(items, CONCURRENCY, async (item, index) => {
    const raw = sources[index];

    // Le serveur fournit dÃ©jÃ  le preview (BG-01 dÃ©ployÃ©) : rien Ã  faire.
    if (raw && raw.preview && raw.preview.title) {
      Object.assign(item, {
        title: raw.preview.title,
        excerpt: raw.preview.excerpt || '',
        imageUrl: raw.preview.image_url || null,
        extra: raw.preview,
      });
      return;
    }

    if (item.objectId == null) return;

    const key = `${item.objectModel}:${item.objectId}`;
    const preview = await previewCache.getOrSet(key, async () => {
      // Articles: fetch from WordPress, all other types: fetch from HumHub
      if (item.type === 'article') {
        const createdAt = (raw.metadata?.created_at || '').slice(0, 10);
        console.log('[enrich] article type, createdAt:', createdAt);
        const wpData = await fetchArticleFromWp(createdAt, item.id);
        console.log('[enrich] WordPress returned:', wpData ? `title=${wpData.title}, image=${wpData.imageUrl}` : 'null');
        return wpData;
      }
      return fetchPreview(item.type, item.objectId, token);
    });

    if (preview) {
      item.title = preview.title || '';
      item.excerpt = preview.excerpt || '';
      item.imageUrl = preview.imageUrl || imageFromFiles(raw.files) || null;
      item.externalUrl = preview.externalUrl || null;
      item.extra = preview.extra || {};
    } else {
      // No data source available for this type.
      item.imageUrl = imageFromFiles(raw.files) || null;
      item.title = GENERIC_TITLE[item.type] || GENERIC_TITLE.other;
      item.needsServerSupport = true;
    }
  });

  return items;
}

module.exports = {
  enrichItems,
  normalizeType,
  toPlainText,
  titleFromText,
  imageFromText,
  imageFromFiles,
  humanSize,
  previewCache,
};


