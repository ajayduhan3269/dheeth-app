import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await api.post(`${endpoint}`, formData);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dh-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-dh-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-dh-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10" style={{ animation: 'fadeInUp 0.6s ease-out forwards' }}>
        <h1 className="text-center text-5xl font-heading font-black text-white tracking-tight">
          DHEETH
        </h1>
        <p className="mt-1 text-center text-dh-accent font-heading font-bold text-sm tracking-widest uppercase">Exam Prep Arena</p>
        <h2 className="mt-4 text-center text-lg text-dh-text-muted font-medium">
          {isLogin ? 'Sign in to continue your streak' : 'Register for the arena'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10" style={{ animation: 'fadeInUp 0.8s ease-out forwards' }}>
        <div className="bg-dh-card py-8 px-6 rounded-2xl border-2 border-b-4 border-dh-border">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-dh-text-muted uppercase tracking-wider mb-2">Username</label>
              <input 
                type="text" 
                required 
                className="appearance-none block w-full px-4 py-3 bg-dh-card border-2 border-dh-border rounded-xl text-dh-text placeholder-dh-text-muted focus:outline-none focus:border-dh-accent transition-colors text-sm"
                placeholder="Enter your username"
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-dh-text-muted uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                required 
                className="appearance-none block w-full px-4 py-3 bg-dh-card border-2 border-dh-border rounded-xl text-dh-text placeholder-dh-text-muted focus:outline-none focus:border-dh-accent transition-colors text-sm"
                placeholder="Enter your password"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            {error && (
              <div className="text-dh-red text-sm font-medium bg-dh-red/10 p-3 rounded-xl border border-dh-red/20">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-heading font-black uppercase tracking-wide text-white bg-dh-accent border-b-4 border-dh-accent-dark focus:outline-none disabled:opacity-50 transition-all active:translate-y-[2px] active:border-b-0"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (isLogin ? 'Enter Arena' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-sm font-medium text-dh-accent-light hover:text-dh-accent transition-colors"
            >
              {isLogin ? "Need an account? Register here." : "Already have an account? Sign in."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}