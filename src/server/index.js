// Configuración de límites de payload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err);
  
  if (err.status === 413) {
    return res.status(413).json({ 
      error: 'Payload too large',
      message: 'El archivo excede el tamaño máximo permitido'
    });
  }
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Error interno del servidor',
    status: err.status || 500
  });
}); 