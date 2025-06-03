# Asistente Educativo - Documentación Técnica

## 📱 Tecnologías Utilizadas
**Backend y Base de Datos**: supabase  
- **Procesamiento de IA**: DeepSeek
  **front**: html5
  **front**:javascript 
  **UI**:node.js
  **Back IA:**:python
  
Supabase para almacenamiento
FastAPI para la API REST


## 🧩 Descripción General
La aplicación es un asistente educativo personalizado que permite a los estudiantes interactuar con un agente inteligente. Este agente es alimentado por la información que sube el profesor, la cual incluye la planificación y los temas de cada materia.

El objetivo es facilitar el estudio y la comprensión de contenidos mediante una experiencia de conversación asistida por IA, completamente adaptada al contenido del curso.

Adicional con la infomracion de las materias el agente IA debe generar la planificacion de estudion y enviar notificaciones a los estudiantes, adicional debe generar por cada tema evaluaciones de 10 preguntas por tema. 

## 🔁 Flujo General de la Aplicación
```mermaid
graph TD
  A[Inicio] --> B[Login / Registro de Usuario]
  B --> C{Tipo de Usuario}
  C -->|Profesor| D[Subir planificación y contenidos]
  C -->|Estudiante| E[Seleccionar materia]
  D --> F[Procesamiento de contenidos con IA (DeepSeek)]
  F --> G[Entrenamiento del Agente Educativo]
  E --> H[Interfaz de Chat con el Agente]
  H --> I[Respuestas personalizadas según contenidos]
```

## 👤 Roles de Usuario

### 🧑‍🏫 Profesor
- Subir documentos de planificación de la materia (PDF, DOCX, texto plano)
- Visualizar materias creadas y contenidos cargados
- Editar o eliminar contenidos
- Disparar el procesamiento de IA para generar el agente

### 🧑‍🎓 Estudiante
- Registrarse y seleccionar materias activas
- Chatear con el agente educativo entrenado con los contenidos de la materia
- Recibir respuestas personalizadas según el temario
- Acceder al historial de conversaciones
- Calificar respuestas para retroalimentación

## 📂 Subida y Procesamiento de Contenidos (Profesor)
1. **Carga de archivo**: El profesor sube los contenidos desde una interfaz intuitiva
2. **Almacenamiento**: Los archivos se guardan en Supabase (Storage)
3. **Procesamiento IA**:
   - DeepSeek procesa el contenido
   - Se crean embeddings del texto
   - Se entrena un agente de QA basado en los temas subidos
4. **Resultado**: El agente queda disponible para los estudiantes registrados en esa materia

## 💬 Interfaz de Chat (Estudiante)
- Basada en React Native Paper para una experiencia fluida y limpia
- Se conecta a Supabase para verificar la identidad y la materia seleccionada
- Llama a DeepSeek para responder preguntas del estudiante usando el conocimiento cargado por el profesor
- Cada mensaje del estudiante se almacena (opcionalmente) para análisis o retroalimentación

## 🔐 Autenticación y Gestión de Sesión
Utiliza Supabase Auth para gestionar:
- Registro/Login de usuarios
- Roles (Profesor vs Estudiante)
- Persistencia de sesión y control de acceso

## 📊 Base de Datos - Supabase
Estructura mínima de tablas:
- `users`: id, name, email, role
- `subjects`: id, name, professor_id
- `documents`: id, subject_id, url, processed
- `students_subjects`: student_id, subject_id
- `messages`: id, student_id, subject_id, message, response, timestamp

## 📈 Escalabilidad y Extensiones Futuras
- 📚 Incluir resúmenes automáticos por tema
- 🗓️ Calendario de evaluaciones y actividades
- 📢 Notificaciones push con Expo
- 📊 Analítica de uso y rendimiento del agente
- 🧠 Fine-tuning del modelo con feedback del estudiante 

assistente-educativo/
├── app/                      # Directorio principal de la aplicación
│   ├── _layout.tsx          # Layout principal de la aplicación
│   ├── index.tsx            # Página de inicio
│   ├── (auth)/              # Rutas de autenticación
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (professor)/         # Rutas del profesor
│   │   ├── dashboard.tsx
│   │   ├── subjects/
│   │   │   ├── [id]/
│   │   │   │   ├── edit.tsx
│   │   │   │   └── upload.tsx
│   │   │   └── index.tsx
│   │   └── settings.tsx
│   └── (student)/           # Rutas del estudiante
│       ├── dashboard.tsx
│       ├── subjects/
│       │   ├── [id]/
│       │   │   └── chat.tsx
│       │   └── index.tsx
│       └── history.tsx
├── components/              # Componentes reutilizables
│   ├── common/             # Componentes comunes
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── professor/          # Componentes específicos del profesor
│   └── student/            # Componentes específicos del estudiante
├── hooks/                  # Custom hooks
│   ├── useAuth.ts
│   ├── useSubjects.ts
│   └── useChat.ts
├── services/              # Servicios y APIs
│   ├── supabase.ts       # Cliente de Supabase
│   ├── deepseek.ts       # Cliente de DeepSeek
│   └── storage.ts        # Servicio de almacenamiento
├── utils/                # Utilidades y helpers
│   ├── constants.ts
│   ├── types.ts
│   └── helpers.ts
├── styles/               # Estilos globales
│   └── theme.ts
└── assets/              # Recursos estáticos
    ├── images/
    └── icons/
```

## 📊 Esquema Completo de la Base de Datos

### Tabla: users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('professor', 'student')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);
```

### Tabla: subjects
```sql
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    professor_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    academic_year VARCHAR(20),
    semester VARCHAR(20)
);
```

### Tabla: documents
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    processed BOOLEAN DEFAULT false,
    processing_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);
```

### Tabla: students_subjects
```sql
CREATE TABLE students_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE(student_id, subject_id)
);
```

### Tabla: messages
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT,
    metadata JSONB
);
```

### Tabla: embeddings
```sql
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    content_chunk TEXT NOT NULL,
    embedding_vector VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Índices
```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subjects_professor ON subjects(professor_id);
CREATE INDEX idx_documents_subject ON documents(subject_id);
CREATE INDEX idx_messages_student ON messages(student_id);
CREATE INDEX idx_messages_subject ON messages(subject_id);
CREATE INDEX idx_students_subjects_student ON students_subjects(student_id);
CREATE INDEX idx_students_subjects_subject ON students_subjects(subject_id);
```

### Políticas de Seguridad (RLS)
```sql
-- Políticas para users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Políticas para subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professors can manage their subjects" ON subjects
    FOR ALL USING (auth.uid() = professor_id);
CREATE POLICY "Students can view enrolled subjects" ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students_subjects
            WHERE student_id = auth.uid()
            AND subject_id = subjects.id
        )
    );

-- Políticas para documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professors can manage their subject documents" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE id = documents.subject_id
            AND professor_id = auth.uid()
        )
    );
CREATE POLICY "Students can view enrolled subject documents" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students_subjects
            WHERE student_id = auth.uid()
            AND subject_id = documents.subject_id
        )
    );
``` 