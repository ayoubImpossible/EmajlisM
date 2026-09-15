/**
 * Global Express error handler
 */
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.stack || err.message);

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux.' });
  }

  const status  = err.status  || err.statusCode || 500;
  const message = err.message || 'Erreur serveur interne.';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
