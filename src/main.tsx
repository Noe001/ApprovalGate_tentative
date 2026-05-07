import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { router } from './router'
import { useThemeStore } from './stores/theme-store'
import './index.css'

// Apply saved theme before first render to prevent flash
try {
  const saved = JSON.parse(localStorage.getItem('ringigate-theme') ?? '{}')
  if (saved?.state?.theme === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  // ignore parse errors
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

const rootElement = document.getElementById('root')!
createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>
)
