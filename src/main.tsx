import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import './theme.css';

// Native look per platform: Ionic styles iOS-like on Apple devices and Material elsewhere. That
// is a styling choice only; device capabilities are still feature-detected (D14, D18).
setupIonicReact();
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
