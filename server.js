const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Configuración de CORS
app.use(cors());

// Configuración de límites de payload
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

// Supabase config desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'OK' : 'NO DEFINIDA');
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_KEY no están definidas. Verifica tu archivo .env');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Asegúrate de que la carpeta uploads exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configuración de multer para guardar en 'uploads'
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // Sanitizar el nombre del archivo
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  }
});
const upload = multer({ storage });

// Ruta para subir archivos
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Devuelve la URL y la ruta del archivo
  const fileUrl = `http://localhost:3001/uploads/${req.file.filename}`;
  console.log('Archivo subido:', {
    filename: req.file.filename,
    path: req.file.path,
    url: fileUrl
  });
  
  res.json({
    fileUrl: fileUrl,
    filePath: req.file.filename // Solo el nombre del archivo
  });
});

// Función para verificar y actualizar la estructura de la tabla
async function checkAndUpdateTableStructure() {
  try {
    // Verificar si la tabla existe
    const { data: tableExists, error: tableError } = await supabase
      .from('files')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      // La tabla no existe, crearla
      const { error: createError } = await supabase.rpc('create_files_table');
      if (createError) {
        console.error('Error al crear la tabla:', createError);
        return false;
      }
    }

    // Verificar y actualizar la estructura de la tabla
    const { error: alterError } = await supabase.rpc('alter_files_table', {
      new_columns: {
        content: 'text',
        type: 'text',
        size: 'bigint',
        folder: 'text',
        subject_id: 'uuid'
      }
    });

    if (alterError) {
      console.error('Error al actualizar la estructura:', alterError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al verificar/actualizar la estructura:', error);
    return false;
  }
}

// Ruta para guardar la información del archivo en la base de datos
app.post('/api/files', async (req, res) => {
  console.log('Recibida petición POST /api/files');
  console.log('Body recibido:', req.body);

  const {
    title, subject_id, user_id,
    file_base64, file_name, file_type, file_size
  } = req.body;

  try {
    // Verificar la estructura de la tabla
    const tableStructureOk = await checkAndUpdateTableStructure();
    if (!tableStructureOk) {
      return res.status(500).json({ 
        error: 'Error en la estructura de la tabla',
        details: 'No se pudo verificar o actualizar la estructura de la tabla files'
      });
    }

    // Preparar el objeto a insertar con los nombres correctos de las columnas
    const fileData = {
      name: title,
      content: file_base64, // Guardamos el contenido en base64
      type: file_type,
      size: file_size,
      folder: 'documents',
      subject_id: subject_id
    };

    console.log('Intentando insertar:', fileData);

    const { data, error } = await supabase
      .from('files')
      .insert([fileData])
      .select()
      .single();

    if (error) {
      console.error('Error detallado al guardar en la base de datos:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      });
    }

    console.log('Archivo guardado exitosamente:', data);
    res.json({ 
      success: true, 
      file: data
    });
  } catch (err) {
    console.error('Error completo en /api/files:', err);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: err.message,
      stack: err.stack
    });
  }
});

// Servir archivos estáticos de la carpeta uploads
app.use('/uploads', express.static(uploadsDir));

app.listen(3001, () => console.log('Servidor backend en http://localhost:3001')); 