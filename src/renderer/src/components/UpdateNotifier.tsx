import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, XCircle, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

interface UpdateInfo {
    version: string
    releaseNotes?: string
}

export default function UpdateNotifier() {
    const [updateState, setUpdateState] = useState<{
        type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
        data?: any
    }>({ type: 'idle' })

    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (!(window as any).electron?.ipcRenderer) {
            console.warn('Electron IPC not available. Simulation mode active.')
            const handleSimulation = (event: MessageEvent) => {
                if (event.data?.type === 'simulate-update-message') {
                    setUpdateState(event.data.data)
                    setIsVisible(true)
                }
            }
            window.addEventListener('message', handleSimulation)
            return () => window.removeEventListener('message', handleSimulation)
        }

        const unsubscribe = (window as any).electron.ipcRenderer.onUpdateMessage((message: any) => {
            console.log('Update Message:', message)
            setUpdateState(message)
            // Show notification for everything except 'idle' and 'not-available' (optional, maybe we show 'not-available' briefly)
            if (message.type !== 'idle') {
                setIsVisible(true)
            }
            
            // Auto-hide 'not-available' after 3 seconds
            if (message.type === 'not-available') {
                setTimeout(() => setIsVisible(false), 3000)
            }
        })

        return () => unsubscribe()
    }, [])

    const handleDownload = () => {
        if ((window as any).electron?.ipcRenderer) {
            (window as any).electron.ipcRenderer.invoke('start-download')
        } else {
            setUpdateState({ type: 'downloading', data: { bytesPerSecond: 102400, percent: 45 } })
        }
    }

    const handleInstall = () => {
        if ((window as any).electron?.ipcRenderer) {
            (window as any).electron.ipcRenderer.invoke('quit-and-install')
        } else {
            alert('Simulation: App would quit and install now.')
        }
    }

    const closeNotifier = () => {
        setIsVisible(false)
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        zIndex: 1000,
                        width: '350px',
                        background: 'var(--bg-sidebar)',
                        border: '1px solid var(--primary)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        padding: '1.25rem',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {updateState.type === 'checking' && <RefreshCw size={20} color="var(--primary)" className="spin" />}
                            {updateState.type === 'not-available' && <CheckCircle size={20} color="var(--success)" />}
                            {updateState.type === 'available' && <Download size={20} color="var(--primary)" />}
                            {updateState.type === 'downloading' && <RefreshCw size={20} color="var(--primary)" className="spin" />}
                            {updateState.type === 'downloaded' && <CheckCircle size={20} color="var(--success)" />}
                            {updateState.type === 'error' && <AlertCircle size={20} color="var(--error)" />}
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                                {updateState.type === 'checking' && 'Checking Updates...'}
                                {updateState.type === 'not-available' && 'App Up to Date'}
                                {updateState.type === 'available' && 'New Update Available!'}
                                {updateState.type === 'downloading' && 'Downloading Update...'}
                                {updateState.type === 'downloaded' && 'Update Ready!'}
                                {updateState.type === 'error' && 'Update Failed'}
                            </h3>
                        </div>
                        <button onClick={closeNotifier} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <XCircle size={18} />
                        </button>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        {updateState.type === 'checking' && 'Searching for new releases on GitHub...'}
                        {updateState.type === 'not-available' && 'You are already using the latest version of CJSoftware License Checker.'}
                        {updateState.type === 'available' && (
                            <>
                                Version <strong>v{updateState.data?.version}</strong> is now available. Would you like to download and install it?
                            </>
                        )}
                        {updateState.type === 'downloading' && (
                            <div style={{ width: '100%' }}>
                                <div style={{ marginBottom: '0.5rem' }}>Downloading at {updateState.data?.bytesPerSecond ? Math.round(updateState.data.bytesPerSecond / 1024) : 0} KB/s...</div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--primary)', width: `${updateState.data?.percent || 0}%` }} />
                                </div>
                            </div>
                        )}
                        {updateState.type === 'downloaded' && (
                            <>
                                Version <strong>v{updateState.data?.version}</strong> has been downloaded. Restart the app now to apply the update?
                            </>
                        )}
                        {updateState.type === 'error' && (
                            <span style={{ color: 'var(--error)' }}>Error: {updateState.data}</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {updateState.type === 'available' && (
                            <button className="primary" onClick={handleDownload} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                Download Now <ArrowRight size={14} />
                            </button>
                        )}
                        {updateState.type === 'downloaded' && (
                            <button className="primary" onClick={handleInstall} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                Restart & Install <RefreshCw size={14} />
                            </button>
                        )}
                        {updateState.type !== 'downloading' && (
                            <button className="secondary" onClick={closeNotifier} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px' }}>
                                Later
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
