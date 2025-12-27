// API Configuration
// Use your local IP address for development so mobile devices can connect
const LOCAL_IP = '192.168.0.200';

export const API_URL = __DEV__ 
  ? `http://${LOCAL_IP}:5000/api` 
  : 'https://api.theweeklydish.com/api';

export const WEB_URL = __DEV__
  ? `http://${LOCAL_IP}:3000`
  : 'https://theweekly-dish.com';

export const APP_SCHEME = 'theweeklydish';