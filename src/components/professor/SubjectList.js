import React from 'react';
import './SubjectList.css';

const SubjectList = ({ subjects, onSubjectSelect, selectedSubject }) => {
    return (
        <div className="subject-list">
            <h3>Mis Materias</h3>
            {subjects.length === 0 ? (
                <div className="no-subjects">
                    <p>No tienes materias registradas</p>
                </div>
            ) : (
                <div className="subjects">
                    {subjects.map((subject) => (
                        <div
                            key={subject.id}
                            className={`subject-item ${selectedSubject?.id === subject.id ? 'selected' : ''}`}
                            onClick={() => onSubjectSelect(subject)}
                        >
                            <div className="subject-name">{subject.name}</div>
                            <div className="subject-code">{subject.code}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SubjectList; 