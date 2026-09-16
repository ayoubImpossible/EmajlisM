/**
 * Markdown -> HTML, volontairement minimal.
 *
 * HumHub renvoie `bodyFormat: 'markdown'` pour les publications et `'html'`
 * pour les articles. L'application affiche déjà du HTML avec
 * react-native-render-html ; il ne manquait qu'une conversion pour le markdown.
 *
 * Pourquoi ne pas ajouter une bibliothèque : le markdown produit par HumHub est
 * restreint (titres, gras, italique, liens, images, listes, citations, code,
 * séparateurs). Une dépendance de plus, à charger sur mobile, pour ce
 * sous-ensemble, ne se justifie pas.
 *
 * Sécurité : le texte est échappé AVANT toute transformation, donc un contenu
 * qui ressemble à du HTML est affiché tel quel et non interprété. Seules les
 * balises engendrées ici sont rendues.
 */

/** Échappe ce qui pourrait être pris pour du HTML. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Seuls http(s) et mailto sont acceptés : pas de javascript:. */
function safeUrl(url) {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(u) ? u : '#';
}

function inline(text) {
  let s = text;

  // Image : ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
    (_m, alt, src) => `<img src="${safeUrl(src)}" alt="${alt}" />`);

  // Lien : [texte](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g,
    (_m, label, href) => `<a href="${safeUrl(href)}">${label}</a>`);

  // Code en ligne
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Gras puis italique (l'ordre compte : ** avant *)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/__([^_]+)__/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');

  // Mention HumHub : [nom](...) déjà traitée ; @utilisateur reste du texte.
  return s;
}

/** Convertit un markdown simple en HTML sûr. */
export function markdownToHtml(markdown) {
  if (!markdown) return '';

  const lines = escapeHtml(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let inList = null;   // 'ul' | 'ol' | null
  let inCode = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push(`</${inList}>`); inList = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Bloc de code délimité
    if (/^```/.test(line.trim())) {
      flushParagraph(); closeList();
      out.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(`${line}\n`); continue; }

    if (!line.trim()) { flushParagraph(); closeList(); continue; }

    // Séparateur
    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph(); closeList(); out.push('<hr />'); continue;
    }

    // Titre
    const h = line.match(/^ {0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      flushParagraph(); closeList();
      const level = Math.min(h[1].length + 1, 6); // h1 -> h2, pour ne pas écraser le titre de l'écran
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // Citation. Le texte a déjà été échappé, donc « > » est ici « &gt; ».
    const q = line.match(/^ {0,3}(?:>|&gt;)\s?(.*)$/);
    if (q) {
      flushParagraph(); closeList();
      out.push(`<blockquote>${inline(q[1])}</blockquote>`);
      continue;
    }

    // Liste à puces
    const ul = line.match(/^ {0,3}[-*+]\s+(.*)$/);
    if (ul) {
      flushParagraph();
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // Liste numérotée
    const ol = line.match(/^ {0,3}\d+[.)]\s+(.*)$/);
    if (ol) {
      flushParagraph();
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  if (inCode) out.push('</pre>');

  return out.join('\n');
}

/**
 * Auto-linkifies bare http(s) URLs in HTML that are not already inside <a> tags.
 * Uses a negative lookbehind for = ' " to skip URLs inside HTML attributes.
 */
function autoLink(html) {
  return html.replace(
    /(?<!['"=])(https?:\/\/[^\s<>"']+)/g,
    (url) => `<a href="${url}">${url}</a>`,
  );
}

/**
 * Rend n'importe quel corps en HTML, selon `bodyFormat`.
 * Un format inconnu est traité comme du texte : échappé, jamais interprété.
 * Les URLs brutes sont auto-transformées en liens cliquables.
 */
export function bodyToHtml(body, bodyFormat) {
  if (!body) return '';
  if (bodyFormat === 'html') return autoLink(body);
  if (bodyFormat === 'markdown') return markdownToHtml(body);
  // plain text — escape first, then wrap, then linkify
  return autoLink(`<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>`);
}
