import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '../../index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OperatorApp } from './OperatorApp'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in operator.html')

createRoot(root).render(
  <StrictMode>
    <OperatorApp />
  </StrictMode>,
)
