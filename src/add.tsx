import React from 'react'
import ReactDOM from 'react-dom/client'
import AddDownloadWindow from './windows/AddDownload/AddDownloadWindow'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AddDownloadWindow />
    </React.StrictMode>,
)
