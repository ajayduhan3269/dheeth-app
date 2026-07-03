import axios from 'axios';

// Single source of truth for the backend URL.
// For production, set VITE_API_URL in client/.env (e.g. VITE_API_URL=https://api.myapp.com)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Single source of truth for avatar rendering.
// DiceBear "micah" style = vibrant full-color manga/anime hero faces.
// Swap the style name here once to re-skin every avatar in the app.
export const getAvatarUrl = (seed = 'default-seed') =>
  `https://api.dicebear.com/8.x/micah/svg?seed=${encodeURIComponent(seed)}`;

const api = axios.create({ baseURL: API_URL });

// Attach the auth token to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dheeth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
