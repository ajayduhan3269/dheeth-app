import React, { useState, useRef } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { sounds } from '../utils/sound';

const AdminUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { totalQuestions, subjects, sampleQuestion }
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const handleFileSelect = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setError(null);
    setResult(null);
    setPreview(null);

    if (!selected.name.endsWith('.json')) {
      setError('Please select a .json file');
      return;
    }

    try {
      const text = await selected.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        setError('File must contain a JSON array of question objects');
        return;
      }

      if (data.length === 0) {
        setError('File is empty — no questions found');
        return;
      }

      // Detect subjects in the file
      const subjects = [...new Set(data.map(q => q.subject).filter(Boolean))];

      setFile({ name: selected.name, data });
      setPreview({
        totalQuestions: data.length,
        subjects,
        sampleQuestion: data[0],
      });
    } catch (err) {
      setError(`Failed to parse JSON: ${err.message}`);
    }
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (replaceExisting) params.set('replace', 'true');

      const res = await api.post(
        `/api/admin/bulk-upload?${params.toString()}`,
        file.data
      );

      if (res.data.success) {
        sounds.win();
        setResult(res.data);
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.details) {
        setError(`${errData.message}\n\nFirst error (question #${errData.details[0]?.index + 1}):\n${JSON.stringify(errData.details[0]?.errors, null, 2)}`);
      } else {
        setError(errData?.message || err.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-dh-bg px-4 py-6 pb-28">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dh-card border-2 border-b-4 border-dh-border text-dh-text-muted font-bold hover:text-dh-text active:border-b-2 active:translate-y-[2px] transition-all"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-heading font-black text-dh-text">Upload Questions</h1>
            <p className="text-dh-text-muted text-sm">Add new subjects by uploading a JSON file</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onClick={() => !file && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer group ${
            file
              ? 'border-dh-accent/50 bg-dh-accent/5'
              : 'border-dh-border hover:border-dh-accent/40 hover:bg-dh-card/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!file ? (
            <>
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📁</div>
              <p className="font-heading font-bold text-dh-text text-lg">Drop your JSON file here</p>
              <p className="text-dh-text-muted text-sm mt-1">or click to browse</p>
              <p className="text-dh-text-muted text-xs mt-3 opacity-60">
                Accepts seed format (question_text, correct_answer) or DB format (questionText, correctOption)
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-3xl">📄</div>
              <div className="text-left flex-1">
                <p className="font-heading font-bold text-dh-text">{file.name}</p>
                <p className="text-dh-text-muted text-sm">{preview?.totalQuestions} questions</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                className="text-dh-red text-sm font-heading font-bold hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Preview Card */}
        {preview && (
          <div className="mt-4 bg-dh-card rounded-2xl border-2 border-dh-border p-5 space-y-4">
            <h3 className="font-heading font-bold text-dh-text text-lg">📋 Preview</h3>

            {/* Subjects detected */}
            <div>
              <p className="text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider mb-2">Subjects Detected</p>
              <div className="flex flex-wrap gap-2">
                {preview.subjects.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full bg-dh-accent/10 border border-dh-accent/30 text-dh-accent text-sm font-heading font-bold">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dh-surface rounded-xl p-3 border border-dh-border">
                <p className="text-2xl font-heading font-black text-dh-accent">{preview.totalQuestions}</p>
                <p className="text-xs text-dh-text-muted font-heading font-bold">Total Questions</p>
              </div>
              <div className="bg-dh-surface rounded-xl p-3 border border-dh-border">
                <p className="text-2xl font-heading font-black text-dh-secondary">{preview.subjects.length}</p>
                <p className="text-xs text-dh-text-muted font-heading font-bold">Subject(s)</p>
              </div>
            </div>

            {/* Sample question */}
            <div>
              <p className="text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider mb-2">Sample Question</p>
              <div className="bg-dh-surface rounded-xl p-3 border border-dh-border">
                <p className="text-sm text-dh-text font-medium">
                  {preview.sampleQuestion.question_text || preview.sampleQuestion.questionText || 'N/A'}
                </p>
                <p className="text-xs text-dh-green mt-1 font-heading font-bold">
                  Answer: {(preview.sampleQuestion.correct_answer || preview.sampleQuestion.correctOption || '?').toUpperCase()}
                </p>
              </div>
            </div>

            {/* Replace toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dh-surface rounded-full peer-checked:bg-dh-red border-2 border-dh-border transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
              <div>
                <p className="text-sm font-heading font-bold text-dh-text">Replace existing</p>
                <p className="text-xs text-dh-text-muted">Delete old questions for these subjects before uploading</p>
              </div>
            </label>

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`w-full py-3.5 rounded-xl font-heading font-bold text-lg transition-all ${
                uploading
                  ? 'bg-dh-surface text-dh-text-muted cursor-wait'
                  : 'bg-dh-accent text-white hover:bg-dh-accent-light active:translate-y-[2px]'
              }`}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading {preview.totalQuestions} questions...
                </span>
              ) : (
                `🚀 Upload ${preview.totalQuestions} Questions`
              )}
            </button>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="mt-4 bg-dh-green/10 border-2 border-dh-green/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">✅</span>
              <div>
                <h3 className="font-heading font-bold text-dh-green text-lg">Upload Successful!</h3>
                <p className="text-sm text-dh-text-muted">{result.message}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-dh-surface rounded-xl p-3 border border-dh-border text-center">
                <p className="text-xl font-heading font-black text-dh-green">{result.insertedCount}</p>
                <p className="text-xs text-dh-text-muted font-heading font-bold">Inserted</p>
              </div>
              {result.deletedCount > 0 && (
                <div className="bg-dh-surface rounded-xl p-3 border border-dh-border text-center">
                  <p className="text-xl font-heading font-black text-dh-red">{result.deletedCount}</p>
                  <p className="text-xs text-dh-text-muted font-heading font-bold">Replaced</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {result.detectedSubjects?.map(s => (
                <span key={s} className="px-3 py-1 rounded-full bg-dh-green/10 border border-dh-green/30 text-dh-green text-sm font-heading font-bold">
                  ✓ {s}
                </span>
              ))}
            </div>
            <button
              onClick={() => navigate('/journey')}
              className="w-full mt-4 py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all"
            >
              View in Journey →
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-dh-red/10 border-2 border-dh-red/30 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <h3 className="font-heading font-bold text-dh-red">Upload Failed</h3>
                <pre className="text-sm text-dh-text-muted mt-1 whitespace-pre-wrap font-mono">{error}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 bg-dh-card rounded-2xl border border-dh-border p-5">
          <h3 className="font-heading font-bold text-dh-text mb-3">📖 JSON Format Guide</h3>
          <div className="bg-dh-surface rounded-xl p-4 border border-dh-border">
            <pre className="text-xs text-dh-text-muted font-mono whitespace-pre-wrap">{`[
  {
    "subject": "Your Subject Name",
    "question_text": "What is ...?",
    "options": {
      "a": "Option A",
      "b": "Option B",
      "c": "Option C",
      "d": "Option D"
    },
    "correct_answer": "b",
    "solution": "Explanation here...",
    "has_diagram": false
  },
  ...
]`}</pre>
          </div>
          <p className="text-xs text-dh-text-muted mt-2">
            Both <code className="text-dh-accent">question_text</code> (seed format) and <code className="text-dh-accent">questionText</code> (DB format) are accepted.
            The subject will auto-appear in Journey once uploaded.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;
