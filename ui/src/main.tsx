import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { NetworkProvider } from './providers/NetworkProvider'
import { SolanaProvider } from './providers/SolanaProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NetworkProvider>
      <SolanaProvider>
        <App />
      </SolanaProvider>
    </NetworkProvider>
  </React.StrictMode>,
)

