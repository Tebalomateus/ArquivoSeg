import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClaimsProvider } from './context/ClaimsContext'
import { PermissionsProvider } from './context/PermissionsContext'
import { ConfirmProvider } from './components/ConfirmDialog'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ClaimsProvider>
                <PermissionsProvider>
                    <ConfirmProvider>
                        <App />
                    </ConfirmProvider>
                </PermissionsProvider>
            </ClaimsProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
