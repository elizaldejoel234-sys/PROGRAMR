import { transformAsync } from '@babel/core';

async function test() {
  const code = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
  `;
  try {
    const result = await transformAsync(code, {
      filename: "main.tsx",
      presets: [
        ['@babel/preset-env', { modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'classic' }],
        '@babel/preset-typescript'
      ]
    });
    console.log(result?.code?.substring(0, 50));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
test();