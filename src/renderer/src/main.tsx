import '@fontsource/ibm-plex-sans-jp/japanese-400.css'
import '@fontsource/ibm-plex-sans-jp/latin-400.css'
import '@fontsource/ibm-plex-sans-jp/japanese-500.css'
import '@fontsource/ibm-plex-sans-jp/latin-500.css'
import '@fontsource/ibm-plex-sans-jp/japanese-600.css'
import '@fontsource/ibm-plex-sans-jp/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Editor from './Editor'
import { applyGlass } from './helpers'

document.documentElement.dataset.platform = /Mac/.test(navigator.platform)
  ? 'mac'
  : /Win/.test(navigator.platform)
    ? 'win'
    : 'linux'

if (location.hash !== '#editor') window.api.getSettings().then((s) => applyGlass(s.glass))

createRoot(document.getElementById('root')!).render(
  <StrictMode>{location.hash === '#editor' ? <Editor /> : <App />}</StrictMode>
)
