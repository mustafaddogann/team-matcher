import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import JoinPage from './components/JoinPage'
import { useHashRouter } from './hooks/useHashRouter'
import './index.css'

function Root() {
  const route = useHashRouter()

  if (route.page === 'join') {
    return <JoinPage sessionId={route.sessionId} />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
