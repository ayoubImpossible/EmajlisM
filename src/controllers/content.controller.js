'use strict';

const { http, asUser, tryGet } = require('../services/humhub');
const { normalizeType, toPlainText, titleFromText, imageFromText } = require('../services/enrich');
const axios = require('axios');

const WP_BASE = (process.env.WP_BASE_URL || 'https://intranet.csefrs.ma').replace(/\/+$/, '');
const WP_API  = `${WP_BASE}/wp-json/wp/v2`;

/** Fetch the best matching WordPress post for an article by date. */
async function fetchWpArticle(createdAt) {
  if (!createdAt) return null;
  try {
    const day    = createdAt.slice(0, 10);
    const after  = `${day}T00:00:00`;
    const before = `${day}T23:59:59`;
    const { data } = await axios.get(`${WP_API}/posts`, {
      params: { per_page: 5, after, before, _embed: 'wp:featuredmedia', orderby: 'date', order: 'desc' },
      timeout: 10000,
    });
    const posts = Array.isArray(data) ? data : [];
    const p = posts[0];
    if (!p) return null;

    const media = p._embedded?.['wp:featuredmedia']?.[0];
    const imageUrl = media?.source_url || null;

    // Keep ALL inline images — they are content (e.g. newspaper scans in revue de presse).
    // Only remove the first <img> if its src matches the featured image exactly,
    // to avoid the cover image appearing twice at the very top of the body.
    let body = p.content?.rendered || '';
    if (imageUrl) {
      // Remove only the first occurrence of the featured image in the body
      const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(
        new RegExp(`<figure[^>]*>[\\s\\S]*?<img[^>]*src=["'][^"']*${escapedUrl.split('/').pop()}[^"']*["'][^>]*>[\\s\\S]*?<\\/figure>`, 'i'),
        '',
      );
    }

    return {
      title:      (p.title?.rendered || '').replace(/&#8211;/g, '–').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim(),
      body,
      bodyFormat: 'html',
      imageUrl,
      extra:      { wpId: p.id, wpUrl: p.link },
    };
  } catch (_) { return null; }
}

/** Charge le modèle spécialisé et en extrait le corps complet. */
async function loadBody(type, objectId, token, createdAt) {
  switch (type) {

    case 'post': {
      const p = await tryGet(`/post/${objectId}`, token);
      if (!p) return null;
      return {
        title: titleFromText(p.message),
        body: p.message || '',
        bodyFormat: 'markdown',
        imageUrl: imageFromText(p.message),
        extra: {},
      };
    }

    case 'article': {
      // MajlissPost / ImportArticle — no HumHub REST endpoint.
      // Fetch from WordPress by the content's created_at date.
      return fetchWpArticle(createdAt);
    }

    case 'calendar': {
      const e = await tryGet(`/calendar/entry/${objectId}`, token);
      if (!e) return null;
      return {
        title: e.title || '',
        body: e.description || '',
        bodyFormat: 'html',
        imageUrl: null,
        extra: {
          startDatetime: e.start_datetime || null,
          endDatetime: e.end_datetime || null,
          allDay: !!e.all_day,
          location: e.location || '',
          participationMode: e.participation_mode ?? null,
          participants: e.participants || null,
        },
      };
    }

    case 'drive_file': {
      const d = await tryGet(`/emajlis/drive/file/${objectId}`, token);
      if (!d?.file) return null;
      const f = d.file;
      return {
        title: f.title || f.filename || '',
        body: f.description || '',
        bodyFormat: 'text',
        imageUrl: null,
        extra: {
          filename: f.filename,
          mimeType: f.mime_type,
          size: f.size,
          humanSize: f.human_size,
          downloadPath: `/api/drive/file/${objectId}/download`,
          versions: d.versions || [],
        },
      };
    }

    case 'page': {
      const p = await tryGet(`/custom-pages/page/${objectId}`, token);
      const page = p?.page || p;
      if (!page) return null;
      return {
        title: page.title || '',
        body: page.page_content || '',
        bodyFormat: page.type === 1 ? 'markdown' : 'html',
        imageUrl: null,
        extra: { pageType: page.type ?? null },
      };
    }

    case 'task': {
      const t = await tryGet(`/tasks/task/${objectId}`, token);
      const task = t?.task || t;
      if (!task) return null;
      return {
        title: task.title || '',
        body: task.description || '',
        bodyFormat: 'html',
        imageUrl: null,
        extra: { status: task.status ?? null, endDatetime: task.end_datetime || null },
      };
    }

    case 'poll': {
      const p = await tryGet(`/polls/poll/${objectId}`, token);
      const poll = p?.poll || p;
      if (!poll) return null;
      return {
        title: poll.question || '',
        body: poll.description || '',
        bodyFormat: 'html',
        imageUrl: null,
        extra: { closed: !!poll.closed, answers: poll.answers || [] },
      };
    }

    default:
      return null;
  }
}

// GET /api/content/:id
exports.show = async (req, res, next) => {
  const token = req.humhubToken;

  try {
    const { data } = await http.get(`/content/${req.params.id}`, asUser(token));
    const meta      = data.metadata || {};
    const type      = normalizeType(meta.object_model || '');
    const createdAt = meta.created_at || null;

    const loaded = await loadBody(type, meta.object_id, token, createdAt);

    res.json({
      id:          data.id,
      objectModel: meta.object_model || '',
      objectId:    meta.object_id ?? null,
      type,
      title:      loaded?.title      || '',
      body:       loaded?.body       || '',
      bodyFormat: loaded?.bodyFormat || 'text',
      excerpt:    toPlainText(loaded?.body || ''),
      imageUrl:   loaded?.imageUrl   || null,
      url:        meta.url           || '',
      createdAt,
      updatedAt:  meta.updated_at    || null,
      author: meta.created_by
        ? { id: meta.created_by.id, name: meta.created_by.display_name || '', url: meta.created_by.url || '' }
        : null,
      containerId: meta.contentcontainer_id ?? null,
      comments:    data.comments || { total: 0 },
      likes:       data.likes    || { total: 0 },
      topics:      data.topics   || [],
      files:       data.files    || [],
      extra:       loaded?.extra || {},
      needsServerSupport: !loaded,
      metadata:    meta,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Contenu introuvable.' });
    if (status === 403) return res.status(403).json({ error: 'Accès refusé à ce contenu.' });
    next(err);
  }
};
