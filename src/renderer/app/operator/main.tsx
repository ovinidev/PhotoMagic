import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '../../index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OperatorApp } from './OperatorApp'
import { RenderErrorBoundary } from './components/RenderErrorBoundary'

// The laptop look (DESIGN §14) is scoped to this window; portals render into <body>, so they get it too.
document.body.dataset.surface = 'laptop'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in operator.html')

createRoot(root).render(
  <StrictMode>
    <RenderErrorBoundary>
      <OperatorApp />
    </RenderErrorBoundary>
  </StrictMode>,
)
