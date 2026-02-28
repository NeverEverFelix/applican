import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './router.tsx'
import { AuthSessionProvider } from './features/auth/AuthSessionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthSessionProvider>
      <AppRouter />
    </AuthSessionProvider>
  </StrictMode>,
)
