import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabaseClient';

const SyllabusTopicsGrid = ({ subjectId }) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subjectId) fetchTopics();
  }, [subjectId]);

  const fetchTopics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('syllabus_topics')
      .select(`
        id,
        topic_number,
        title,
        description,
        syllabus_subtopics (
          id,
          subtopic_number,
          title,
          description
        )
      `)
      .eq('subject_id', subjectId)
      .order('topic_number', { ascending: true });

    if (!error) setTopics(data || []);
    setLoading(false);
  };

  if (loading) return <div>Cargando temas...</div>;
  if (!topics.length) return <div>No hay temas analizados para este sílabo.</div>;

  return (
    <div className="syllabus-grid">
      <table>
        <thead>
          <tr>
            <th>N° Tema</th>
            <th>Título</th>
            <th>Descripción</th>
            <th>Subtemas</th>
          </tr>
        </thead>
        <tbody>
          {topics.map(topic => (
            <tr key={topic.id}>
              <td>{topic.topic_number}</td>
              <td>{topic.title}</td>
              <td>{topic.description}</td>
              <td>
                {topic.syllabus_subtopics && topic.syllabus_subtopics.length > 0 ? (
                  <ul>
                    {topic.syllabus_subtopics.map(sub => (
                      <li key={sub.id}>
                        <strong>{sub.subtopic_number}:</strong> {sub.title}
                        <div style={{ fontSize: '0.95em', color: '#666' }}>{sub.description}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: '#aaa' }}>Sin subtemas</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .syllabus-grid table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        .syllabus-grid th, .syllabus-grid td {
          border: 1px solid #e0e0e0;
          padding: 8px 12px;
          text-align: left;
        }
        .syllabus-grid th {
          background: #f5f5f5;
        }
      `}</style>
    </div>
  );
};

export default SyllabusTopicsGrid; 