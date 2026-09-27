import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

document.documentElement.dataset.platform = /Mac/.test(navigator.platform)
  ? 'mac'
  : /Win/.test(navigator.platform)
    ? 'win'
    : 'linux'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
