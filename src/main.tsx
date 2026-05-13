import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('[main] Starting React...')

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('[main] React mounted successfully')
} catch (err) {
  console.error('[main] React mount failed:', err)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<div style="padding: 40px; font-family: sans-serif;">
      <h2 style="color: #dc2626;">启动失败</h2>
      <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
    </div>`
  }
}
