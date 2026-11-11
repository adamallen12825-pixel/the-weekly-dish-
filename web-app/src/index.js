import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Keep diagnostic logging out of visitors' browser consoles in production.
// Real errors (console.error / console.warn) are still reported.
if (process.env.NODE_ENV === 'production') {
  const quiet = () => {};
  console.log = quiet;
  console.debug = quiet;
  console.info = quiet;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
