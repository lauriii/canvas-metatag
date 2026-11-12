import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';

import App from './App';

import '@radix-ui/themes/styles.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Canvas's own theme. Always light: the host is, whatever the OS prefers. */}
    <Theme
      appearance="light"
      accentColor="blue"
      grayColor="slate"
      radius="medium"
      scaling="100%"
      hasBackground={false}
    >
      <App />
    </Theme>
  </StrictMode>,
);
