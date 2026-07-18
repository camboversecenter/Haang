import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker with immediate automatic updates enabled
if ('serviceWorker' in navigator && !window.location.host.includes('localhost')) {
  registerSW({ immediate: true });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);