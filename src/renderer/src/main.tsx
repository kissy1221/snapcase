import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Editor from './Editor'

document.documentElement.dataset.platform = /Mac/.test(navigator.platform)
  ? 'mac'
  : /Win/.test(navigator.platform)
    ? 'win'
    : 'linux'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{location.hash === '#editor' ? <Editor /> : <App />}</StrictMode>
)
