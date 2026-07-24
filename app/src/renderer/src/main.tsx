import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ChatTranslationOverlay from './ChatTranslationOverlay'
import ChatComposeWindow from './ChatComposeWindow'
import './index.css'

const isChatTranslationOverlay = window.location.hash.includes('chat-translation-overlay')
const isChatCompose = window.location.hash.includes('chat-compose')

function selectRootComponent(): JSX.Element {
  if (isChatTranslationOverlay) {
    return <ChatTranslationOverlay />
  }
  if (isChatCompose) {
    return <ChatComposeWindow />
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{selectRootComponent()}</React.StrictMode>
)
