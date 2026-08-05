import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerAllModules } from './modules';
import './styles.css';

// Registrar todos los modulos (plugins) antes de montar la app.
registerAllModules();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
