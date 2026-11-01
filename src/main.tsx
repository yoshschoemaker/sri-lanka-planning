import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Side-effect import: Chromium vuurt beforeinstallprompt vaak al vóór React
// mount, dus de listener moet hier staan en niet in een component.
import './utils/deferredInstallPrompt'
import './index.css'
import App from './App.tsx'
import { ServiceWorkerProvider } from './components/ServiceWorkerProvider.tsx'
import { CommunityProvider } from './components/CommunityProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServiceWorkerProvider>
      <CommunityProvider>
        <App />
      </CommunityProvider>
    </ServiceWorkerProvider>
  </StrictMode>,
)
