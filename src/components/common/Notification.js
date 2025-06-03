import React from 'react';
import './Notification.css';

const Notification = ({ message, type, onClose }) => {
    return (
        <div className={`notification ${type}`}>
            <div className="notification-content">
                <span className="notification-icon">
                    {type === 'success' ? '✓' : '✕'}
                </span>
                <span className="notification-message">{message}</span>
            </div>
            <button className="notification-close" onClick={onClose}>×</button>
        </div>
    );
};

export default Notification; 