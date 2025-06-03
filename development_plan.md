# 🧠 Plan de Desarrollo: Asistente Educativo Inteligente

## 🎯 Objetivo General
Desarrollar una plataforma educativa interactiva asistida por IA que permita a estudiantes estudiar contenidos, generar evaluaciones y planificar su aprendizaje a partir de documentos cargados por profesores.

---

## 🔁 Fase 1: Preparación del Entorno y Configuración Base ✅

**Objetivos:**
- Configurar Supabase como backend principal.
- (Opcional) Configurar Django para gestión CRUD avanzada.
- Migrar autenticación y base de datos.
- Crear estructura inicial de roles y tablas.

**Acciones Clave:**
- [x] Crear proyecto en Supabase.
- [x] Configurar Supabase Auth para login/registro.
- [x] Crear tablas: `users`, `subjects`, `documents`, `students_subjects`, `messages`, `embeddings`.
- [x] Definir políticas RLS (Row Level Security) según roles (profesor/estudiante).
- [ ] (Opcional) Inicializar proyecto Django para CRUD de objetos educativos.

**Estado Actual:**
- ✅ Configuración inicial de Supabase completada
- ✅ Tablas creadas en la base de datos
- ✅ Políticas RLS implementadas
- ✅ Sistema de autenticación configurado
- ⚠️ Próximo paso: Implementar registro de usuarios
- ⚠️ (Opcional) Evaluar integración Django para CRUD

---

## 👤 Fase 2: Gestión de Usuarios y Roles (En Progreso)

**Objetivos:**
- Definir roles y flujos separados para profesores y estudiantes.
- Permitir gestión CRUD de usuarios, materias, profesores, estudiantes, mensajes, etc. usando Django (opcional).

**Acciones Clave:**
- [ ] Implementar lógica de asignación de rol al registrarse.
- [ ] **Profesor:**
  - [ ] Subir documentos en PDF, DOCX o texto.
  - [ ] Asociar documentos a materias.
  - [ ] Activar el procesamiento con IA.
- [ ] **Estudiante:**
  - [ ] Registrarse y seleccionar materias.
  - [ ] Acceder al agente educativo.
- [ ] (Opcional) Implementar vistas y endpoints CRUD en Django para:
  - [ ] Materias
  - [ ] Profesores
  - [ ] Estudiantes
  - [ ] Mensajes
  - [ ] Documentos

**Estado Actual:**
- ✅ Estructura base de roles implementada
- ⚠️ En desarrollo: Registro de usuarios
- ⚠️ Pendiente: Implementar lógica de asignación de roles
- ⚠️ (Opcional) CRUD Django en análisis/desarrollo

---

## 📄 Fase 3: Procesamiento de Documentos con IA (DeepSeek)

**Objetivos:**
- Permitir a profesores cargar contenidos para entrenamiento.
- Procesar documentos con DeepSeek y generar embeddings.

**Acciones Clave:**
- [ ] Integrar API de DeepSeek para extracción y vectorización de contenido.
- [ ] Almacenar embeddings en Supabase (`embeddings` table).
- [ ] Asociar documentos procesados a materias y usuarios.

---

## 💬 Fase 4: Chat Educativo y Respuestas Personalizadas

**Objetivos:**
- Implementar interfaz de chat.
- Mostrar respuestas contextuales y calificables.

**Acciones Clave:**
- [ ] Crear componente de chat con frontend en HTML/JavaScript.
- [ ] Enviar mensajes a backend → consultar embeddings → respuesta de IA.
- [ ] Guardar historial de chat en la tabla `messages`.
- [ ] Permitir calificación de respuesta por parte del estudiante.
- [ ] (Opcional) Permitir gestión y visualización de mensajes vía Django admin/API.

---

## 🧪 Fase 5: Evaluaciones y Planificación de Estudio

**Objetivos:**
- Generar cuestionarios por tema.
- Crear cronograma de estudio personalizado para estudiantes.

**Acciones Clave:**
- [ ] Generar evaluaciones de 10 preguntas por tema.
- [ ] Crear tabla y lógica de planificación por estudiante.
- [ ] Enviar notificaciones (correo o in-app) con recordatorios de estudio.

---

## 💻 Fase 6: UI y Frontend General

**Objetivos:**
- Crear una interfaz intuitiva usando HTML5, JavaScript y Node.js.
- (Opcional) Integrar endpoints Django para CRUD desde el frontend.

**Acciones Clave:**
- [ ] Diseño responsive para paneles de profesores y estudiantes.
- [ ] **Panel de profesor:** gestión de materias, contenidos, IA y estudiantes.
- [ ] **Panel de estudiante:** selección de materias, chat, evaluaciones, planificación.
- [ ] (Opcional) Consumir API Django para gestión CRUD desde el frontend.

---

## ✅ Fase 7: Testing y Despliegue

**Objetivos:**
- Garantizar calidad del producto.
- Publicar MVP funcional para pruebas reales.

**Acciones Clave:**
- [ ] Realizar pruebas unitarias y de integración.
- [ ] Deploy en Vercel/Netlify para frontend, Supabase para backend.
- [ ] (Opcional) Deploy de backend Django en servidor propio o servicio cloud.
- [ ] Validar funcionalidad con profesores y estudiantes reales.

---

## 🛠 Tecnologías Principales

- **Backend & DB:** Supabase (y/o Django para CRUD avanzado)
- **Procesamiento de IA:** DeepSeek
- **Frontend:** HTML5, JavaScript
- **Interfaz y Lógica UI:** Node.js
- **(Opcional) Backend CRUD:** Django

---

## 👥 Roles de Usuario

### Profesor
- Sube documentos (PDF, DOCX, TXT).
- Gestiona materias y contenidos.
- Activa procesamiento de IA.
- (Opcional) Gestiona objetos educativos vía Django admin/API.

### Estudiante
- Se registra y selecciona materias.
- Interactúa con el agente educativo.
- Califica respuestas del agente.

---

## 📊 Estructura de Base de Datos (Supabase/Django)

**Tablas Principales:**
- `users`
- `subjects`
- `documents`
- `students_subjects`
- `messages`
- `embeddings`

**Sistema de Autenticación:**
- Supabase Auth
- Políticas RLS por rol
- (Opcional) Django Auth para administración avanzada

# Configuración del servidor
PORT=3001
NODE_ENV=development

# Configuración de Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_KEY=tu_clave_de_supabase
SUPABASE_SERVICE_KEY=tu_clave_de_servicio_de_supabase

# Configuración de JWT
JWT_SECRET=una_clave_secreta_para_jwt

# Configuración de correo electrónico
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=tu_usuario_smtp
SMTP_PASS=tu_contraseña_smtp
