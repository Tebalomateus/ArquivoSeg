import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClaimsProvider } from './context/ClaimsContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ClaimsProvider>
                <App />
            </ClaimsProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
