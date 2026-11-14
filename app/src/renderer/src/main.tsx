import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ChatTranslationOverlay from './ChatTranslationOverlay'
import './index.css'

const isChatTranslationOverlay = window.location.hash.includes('chat-translation-overlay')

function selectRootComponent(): JSX.Element {
  if (isChatTranslationOverlay) {
    return <ChatTranslationOverlay />
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{selectRootComponent()}</React.StrictMode>
)
