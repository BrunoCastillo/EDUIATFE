import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        role: 'student' // Por defecto estudiante
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Validaciones del formulario
        if (!formData.email || !formData.password || !formData.confirmPassword || !formData.fullName) {
            setError('Todos los campos son requeridos');
            setLoading(false);
            return;
        }

        // Validar contraseñas
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }

        // Validar longitud de contraseña
        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        try {
            const result = await authService.register(
                formData.email,
                formData.password,
                formData.fullName,
                formData.role
            );

            if (result?.user) {
                setSuccess('¡Usuario registrado exitosamente! Por favor, verifica tu correo electrónico.');
                // Redirigir al login después de 3 segundos
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError('Error al registrar usuario. Por favor, intenta nuevamente.');
            }
        } catch (error) {
            console.error('Error en registro:', error);
            setError(error.message || 'Error al registrar usuario. Por favor, intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <h2>Registro</h2>
                
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
                
                <div className="form-group">
                    <label htmlFor="fullName">Nombre Completo</label>
                    <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email">Correo Electrónico</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Contraseña</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="role">Rol</label>
                    <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                    >
                        <option value="student">Estudiante</option>
                        <option value="professor">Profesor</option>
                    </select>
                </div>

                <button 
                    type="submit" 
                    className="login-button"
                    disabled={loading}
                >
                    {loading ? 'Registrando...' : 'Registrarse'}
                </button>

                <div className="form-footer">
                    <Link to="/login">¿Ya tienes cuenta? Inicia sesión</Link>
                </div>
            </form>
        </div>
    );
};

export default Register; 