import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    process: {
        platform: process.platform
    },
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        onUpdateMessage: (callback: (message: any) => void) => {
            const listener = (_event: any, message: any) => callback(message)
            ipcRenderer.on('update-message', listener)
            return () => ipcRenderer.removeListener('update-message', listener)
        }
    }
})
