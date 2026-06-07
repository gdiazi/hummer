// src/middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error:   err.message || 'Error interno del servidor',
    status:  err.status  || 500,
  });
}

module.exports = errorHandler;