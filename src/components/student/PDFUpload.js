import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import './PDFUpload.css';

const PDFUpload = ({ subjectId, onSuccess }) => {
  const { user, session } = useAuth();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Cargar archivos cuando cambia la materia
  useEffect(() => {
    if (subjectId) {
      fetchFiles();
    }
  }, [subjectId]);

  const fetchFiles = async () => {
    try {
      console.log('Cargando archivos para la materia:', subjectId);
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar archivos:', error);
        throw error;
      }

      console.log('Archivos cargados:', data);
      setUploadedFiles(data || []);
    } catch (err) {
      console.error('Error al cargar archivos:', err);
      setError('Error al cargar los archivos');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) {
      setError('Por favor, selecciona un archivo y proporciona un título');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convertir el archivo a base64
      const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });

      const fileBase64 = await toBase64(file);

      const response = await fetch('http://localhost:3001/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          subject_id: subjectId,
          user_id: user.id,
          file_base64: fileBase64,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al subir el archivo');
      }

      const data = await response.json();
      console.log('Archivo subido exitosamente:', data);
      onSuccess(data);
      resetForm();
      // Recargar la lista de archivos
      fetchFiles();
    } catch (err) {
      console.error('Error completo:', err);
      setError(err.message || 'Error al subir el archivo');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setFile(null);
    setError(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="pdf-upload-container">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Título del archivo:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="file">Seleccionar archivo PDF:</label>
          <input
            type="file"
            id="file"
            accept=".pdf"
            onChange={handleFileChange}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Subiendo...' : 'Subir archivo'}
        </button>
      </form>

      {/* Lista de archivos subidos */}
      <div className="uploaded-files">
        <h3>Archivos subidos</h3>
        {uploadedFiles.length === 0 ? (
          <p>No hay archivos subidos para esta materia</p>
        ) : (
          <ul>
            {uploadedFiles.map((file) => (
              <li key={file.id}>
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-date">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PDFUpload; 