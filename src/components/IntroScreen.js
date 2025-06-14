import React from 'react';
import { useNavigate } from 'react-router-dom';
import './student/Dashboard.css';

const IntroScreen = ({ role }) => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-overview">
      <h2>Bienvenido a EDUIA</h2>
      <p style={{ fontSize: '1.1rem', color: '#444', marginTop: '1rem' }}>
        Esta es tu plataforma educativa inteligente.<br />
        {role === 'profesor'
          ? 'Aquí podrás gestionar tus Materias, interactuar con tus estudiantes y aprovechar la inteligencia artificial para mejorar la experiencia educativa.'
          : 'Aquí podrás consultar tus materias, interactuar con el asistente IA y potenciar tu aprendizaje.'}
      </p>
      <ul style={{ margin: '2rem auto', maxWidth: 400, textAlign: 'left', color: '#555', fontSize: '1rem' }}>
        <li>{role === 'profesor' ? 'Crear y gestionar Materias' : 'Consultar y gestionar tus asignaturas'}</li>
        <li>{role === 'profesor' ? 'Interactuar con el asistente IA para preparar clases y responder dudas' : 'Resolver dudas con el asistente IA'}</li>
        <li>{role === 'profesor' ? 'Cargar y compartir materiales de estudio' : 'Acceder a materiales de estudio'}</li>
        <li>{role === 'profesor' ? 'Revisar el progreso de tus estudiantes' : 'Revisar tu progreso académico'}</li>
        <li>{role === 'profesor' ? 'Gestionar evaluaciones y calificaciones' : 'Inscribirte en nuevas materias'}</li>
      </ul>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
        <button className="enroll-button" onClick={() => navigate('/login')}>Iniciar Sesión</button>
        <button className="enroll-button" style={{ background: '#1976d2' }} onClick={() => navigate('/register')}>Registrarse</button>
      </div>
      <p style={{ color: '#1976d2', fontWeight: 'bold', marginTop: '2rem' }}>
        ¡Explora el menú lateral para comenzar!
      </p>
    </div>
  );
};

export default IntroScreen; 