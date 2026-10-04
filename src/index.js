import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted type: no Google Fonts round trip. Only the latin weights we use.
// Barlow Condensed ships 700/800 only, so any condensed text renders bold.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import App from './App';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
