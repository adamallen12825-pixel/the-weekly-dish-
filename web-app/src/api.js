import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  signup: (email, password) => api.post('/auth/signup', { email, password }),
  signin: (email, password) => api.post('/auth/signin', { email, password }),
  verify: () => api.get('/auth/verify'),
};

export const payments = {
  createCheckoutSession: () => api.post('/payments/create-checkout-session'),
  verifyPayment: (sessionId) => api.post('/payments/payment-success', { sessionId }),
};

export const users = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profile) => api.put('/users/profile', profile),
};

export default api;