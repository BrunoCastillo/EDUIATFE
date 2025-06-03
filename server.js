const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

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
    // Intentar crear la tabla si no existe
    const { error: createError } = await supabase.rpc('create_files_table_if_not_exists');
    
    if (createError) {
      console.error('Error al crear la tabla:', createError);
      return false;
    }

    // Obtener la estructura actual de la tabla
    const { data: tableInfo, error: tableError } = await supabase
      .from('files')
      .select('*')
      .limit(0);

    if (tableError) {
      console.error('Error al obtener estructura de la tabla:', tableError);
      return false;
    }

    console.log('Estructura actual de la tabla files:', Object.keys(tableInfo[0] || {}));

    // Verificar si la tabla existe y tiene las columnas necesarias
    const requiredColumns = [
      'id',
      'name',
      'path',
      'type',
      'size',
      'folder',
      'subject_id',
      'created_at',
      'updated_at'
    ];

    const existingColumns = Object.keys(tableInfo[0] || {});
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('Columnas faltantes:', missingColumns);
      // Intentar agregar las columnas faltantes
      const { error: alterError } = await supabase.rpc('add_missing_columns', {
        missing_columns: missingColumns
      });

      if (alterError) {
        console.error('Error al agregar columnas faltantes:', alterError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error al verificar estructura de la tabla:', err);
    return false;
  }
}

// Ruta para guardar la información del archivo en la base de datos
app.post('/api/files', async (req, res) => {
  console.log('Recibida petición POST /api/files');
  console.log('Body recibido:', req.body);

  const {
    title, subject_id, user_id,
    file_path, file_url, file_name, file_type, file_size
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
      path: file_path,
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
    res.json({ success: true, file: data });
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