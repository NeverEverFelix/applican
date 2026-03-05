import "./sentry.ts";
import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './router.tsx'
import { AuthSessionProvider } from './features/auth/AuthSessionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <AuthSessionProvider>
        <AppRouter />
      </AuthSessionProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
