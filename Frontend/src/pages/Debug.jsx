import React, { useState, useEffect } from 'react';
import { ExamCredential } from '@/entities/ExamCredential';
import { Exam } from '@/entities/Exam';

export default function DebugPage() {
  const [exams, setExams] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState('');
  const [credentialForm, setCredentialForm] = useState({
    exam_access_id: '',
    password: '',
    max_uses: 1
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const examData = await Exam.list();
      const credData = await ExamCredential.list();
      
      console.log('[DEBUG PAGE] Exams:', examData);
      console.log('[DEBUG PAGE] Credentials:', credData);
      
      setExams(examData || []);
      setCredentials(credData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const createTestCredential = async () => {
    if (!selectedExam || !credentialForm.exam_access_id || !credentialForm.password) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        exam_id: selectedExam,
        exam_access_id: credentialForm.exam_access_id,
        password: credentialForm.password,
        max_uses: credentialForm.max_uses,
        is_active: true,
        used_count: 0,
        created_at: new Date().toISOString()
      };

      console.log('[DEBUG PAGE] Creating credential with payload:', payload);
      const result = await ExamCredential.create(payload);
      console.log('[DEBUG PAGE] Create result:', result);

      alert('Credential created! Check console for details.');
      await loadData();
      setCredentialForm({ exam_access_id: '', password: '', max_uses: 1 });
    } catch (error) {
      console.error('Error creating credential:', error);
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Page - Base44 API Testing</h1>
      
      <button onClick={loadData} disabled={loading}>
        {loading ? 'Loading...' : 'Reload Data'}
      </button>

      <h2>Exams ({exams.length})</h2>
      {exams.length > 0 && (
        <>
          <pre>{JSON.stringify(exams[0], null, 2)}</pre>
          <select 
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            style={{ padding: '8px', marginTop: '10px' }}
          >
            <option value="">Select an exam</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>{exam.title || exam.id}</option>
            ))}
          </select>
        </>
      )}

      <h2 style={{ marginTop: '30px' }}>Credentials ({credentials.length})</h2>
      {credentials.length > 0 && (
        <div>
          <h3>Sample Credential:</h3>
          <pre>{JSON.stringify(credentials[0], null, 2)}</pre>
          <h3>Field Names:</h3>
          <ul>
            {Object.keys(credentials[0]).map(key => (
              <li key={key}>{key}: {typeof credentials[0][key]}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 style={{ marginTop: '30px' }}>Create Test Credential</h2>
      <div style={{ marginTop: '10px' }}>
        <input
          type="text"
          placeholder="Access ID"
          value={credentialForm.exam_access_id}
          onChange={(e) => setCredentialForm(prev => ({ ...prev, exam_access_id: e.target.value }))}
          style={{ display: 'block', margin: '5px', padding: '5px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={credentialForm.password}
          onChange={(e) => setCredentialForm(prev => ({ ...prev, password: e.target.value }))}
          style={{ display: 'block', margin: '5px', padding: '5px' }}
        />
        <input
          type="number"
          placeholder="Max Uses"
          value={credentialForm.max_uses}
          onChange={(e) => setCredentialForm(prev => ({ ...prev, max_uses: parseInt(e.target.value) }))}
          style={{ display: 'block', margin: '5px', padding: '5px' }}
        />
        <button 
          onClick={createTestCredential}
          disabled={loading || !selectedExam}
          style={{ padding: '8px 16px', marginTop: '10px' }}
        >
          Create Test Credential
        </button>
      </div>
    </div>
  );
}
