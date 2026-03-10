import { useState, useEffect } from 'react'
import { LayoutDashboard, Monitor, PlusCircle, Search, Save, Trash2, CheckCircle, ShieldCheck, XCircle, AlertCircle, RefreshCw, Smartphone, Download, ChevronUp, ChevronDown, ArrowUpAZ, History, List, Package, HelpCircle, BookOpen, ChevronRight, MonitorPlay, ArrowRight, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Device {
    id?: number
    asset_tag: string
    brand_model: string
    location: string
    assigned_user: string
    created_at?: string
}

interface Software {
    id?: number
    name: string
    version: string
    is_licensed: boolean
    license_validity: string
    type: string
    license_required: boolean
    compliance_note?: string
    alternative?: { name: string; url: string } | null
    icon?: string
}

export default function App() {
    const [devices, setDevices] = useState<Device[]>([])
    const [software, setSoftware] = useState<Software[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isChangelogOpen, setIsChangelogOpen] = useState(false)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [onboardingStep, setOnboardingStep] = useState(0)
    const [osStatus, setOsStatus] = useState<{ status: string; osName: string; osVersion: string; note: string } | null>(null)
    const [officeStatus, setOfficeStatus] = useState<{ status: string; note: string } | null>(null)
    const [sortConfig, setSortConfig] = useState<{ key: keyof Software; direction: 'asc' | 'desc' } | null>({ key: 'is_licensed', direction: 'asc' })
    const [theme, setTheme] = useState(localStorage.getItem('cj_license_checker_theme') || 'dark')

    // Auto-updater state
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available'>('idle')
    const [updateInfo, setUpdateInfo] = useState<{ version?: string; percent?: number; error?: string } | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        assetTag: '',
        brandModel: '',
        location: '',
        assignedUser: ''
    })

    useEffect(() => {
        loadLastDevice()
        // Initial OS status check on mount
        if ((window as any).electron?.ipcRenderer) {
            window.electron.ipcRenderer.invoke('check-os-status').then(setOsStatus).catch(console.error)
        }

        const seenOnboarding = localStorage.getItem('cj_license_checker_onboarded')
        if (!seenOnboarding) {
            setShowOnboarding(true)
        }

        // Register the auto-updater message listener
        // The preload exposes onUpdateMessage which bridges the main process IPC to the renderer
        const renderer = (window as any).electron?.ipcRenderer
        if (renderer?.onUpdateMessage) {
            const unsubscribe = renderer.onUpdateMessage((msg: any) => {
                switch (msg.type) {
                    case 'checking':     setUpdateStatus('checking'); break
                    case 'available':
                        setUpdateStatus('available')
                        setUpdateInfo({ version: msg.data?.version })
                        // macOS: in-app download requires code signing, which we don't have.
                        // Instead, open the GitHub Releases page directly so the user can
                        // manually download the new DMG — no extra clicks needed.
                        if ((window as any).electron?.process?.platform === 'darwin') {
                            window.open('https://github.com/selrahcDC/cjsoftware-license-checker/releases', '_blank')
                        }
                        break
                    case 'not-available': setUpdateStatus('not-available'); break
                    case 'downloading':  setUpdateStatus('downloading'); setUpdateInfo(prev => ({ ...prev, percent: Math.round(msg.data?.percent || 0) })); break
                    case 'downloaded':   setUpdateStatus('downloaded'); setUpdateInfo(prev => ({ ...prev, version: msg.data?.version })); break
                    case 'error':        setUpdateStatus('error'); setUpdateInfo({ error: msg.data }); break
                }
            })
            return unsubscribe
        }
    }, [])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('cj_license_checker_theme', theme);
    }, [theme]);

    useEffect(() => {
        const ids = ['tour-computer-info', 'tour-scan-button', 'tour-results-table', 'tour-os-status', 'tour-save-button'];
        const targetId = ids[onboardingStep - 1];
        if (targetId) {
            const el = document.getElementById(targetId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [onboardingStep]);

    const loadLastDevice = async () => {
        if (!(window as any).electron?.ipcRenderer) return
        const data = await window.electron.ipcRenderer.invoke('get-devices')
        setDevices(data)
        if (data.length > 0) {
            // Pre-fill with last device or stay empty for new entry
            setFormData({
                assetTag: data[0].asset_tag,
                brandModel: data[0].brand_model,
                location: data[0].location,
                assignedUser: data[0].assigned_user
            })
            const sw = await window.electron.ipcRenderer.invoke('get-software', data[0].id)
            setSoftware(sw)
        }
    }

    const runScan = async () => {
        if (!formData.assetTag || !formData.assignedUser) {
            alert('Please fill in Asset Tag and Assigned User first.')
            return
        }
        setIsScanning(true)
        setSoftware([])
        setOsStatus(null)

        try {
            // Check for Electron availability
            if (!(window as any).electron?.ipcRenderer) {
                alert('Simulation: Scanning logic not available in browser.')
                setIsScanning(false)
                return
            }

            // Acknowledge scanning start with a small delay for UI feedback
            await new Promise(r => setTimeout(r, 100))

            // Run Software Scan (Main Priority)
            console.log('[App] Initiating software inventory scan...')
            try {
                const results = await window.electron.ipcRenderer.invoke('scan-software')
                const softwareResults = Array.isArray(results) ? results : []
                setSoftware(softwareResults)
                console.log(`[App] Software scan finished. Found ${softwareResults.length} items.`)
            } catch (scanErr) {
                console.error('[App] Software scan failed:', scanErr)
                alert('Software scan failed. Please check app permissions.')
                setSoftware([])
            }

            // Run System Status Checks in parallel (Non-blocking fallback)
            console.log('[App] Checking system security status...')
            Promise.all([
                window.electron.ipcRenderer.invoke('check-os-status').catch(e => {
                    console.warn('OS status check failed:', e)
                    return { status: 'ERROR', note: 'Failed to access OS status' }
                }),
                window.electron.ipcRenderer.invoke('check-office-license').catch(e => {
                    console.warn('Office license check failed:', e)
                    return null
                })
            ]).then(([osInfo, officeInfo]) => {
                setOsStatus(osInfo)
                const isWin = (window as any).electron.process?.platform === 'win32' || navigator.userAgent.includes('Windows')
                if (isWin) setOfficeStatus(officeInfo)
            })

        } catch (e) {
            console.error('Critical scan error:', e)
            alert('A critical error occurred during scanning.')
        } finally {
            setIsScanning(false)
        }
    }

    const handleSaveAndAudit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (software.length === 0) {
            alert('Please scan software before saving.')
            return
        }

        setIsSaving(true)
        try {
            if (!(window as any).electron?.ipcRenderer) {
                alert('Simulation: Saving not available in browser.')
                setIsSaving(false)
                return
            }
            const deviceId = await window.electron.ipcRenderer.invoke('save-device', formData)
            const formattedSoftware = software.map(sw => ({
                name: sw.name,
                version: sw.version,
                isLicensed: sw.is_licensed ? 1 : 0,
                licenseValidity: sw.license_validity || 'N/A',
                type: sw.type,
                licenseRequired: sw.license_required ? 1 : 0,
                complianceNote: sw.compliance_note || ''
            }))
            await window.electron.ipcRenderer.invoke('save-software', deviceId, formattedSoftware)
            alert('Asset and Software Audit Saved Successfully!')
            loadLastDevice()
        } catch (e) {
            alert('Failed to save audit.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteDevice = async (id: number) => {
        if (!confirm('Are you sure you want to delete this audit record? This cannot be undone.')) return
        try {
            if ((window as any).electron?.ipcRenderer) {
                await window.electron.ipcRenderer.invoke('delete-device', id)
            }
            loadLastDevice()
        } catch (e) {
            alert('Failed to delete audit.')
        }
    }

    const handleResetForm = () => {
        setFormData({
            assetTag: '',
            brandModel: '',
            location: '',
            assignedUser: ''
        })
        setSoftware([])
    }

    const handleExportCSV = () => {
        if (software.length === 0) return

        // FLAT FILE FORMAT: Perfect for importing into centralized dashboards (Excel, PowerBI, SQL)
        // Every software row contains the computer/user context for easy aggregation.
        const headers = [
            "Scan_ID",
            "Audit_Date",
            "Institution",
            "Asset_Tag",
            "Assigned_User",
            "Location",
            "Brand_Model",
            "OS_Status",
            "Software_Name",
            "Software_Version",
            "Software_Type",
            "License_Required",
            "Compliance_Status",
            "License_Validity",
            "Compliance_Note",
            "Recommended_Alternative",
            "Alternative_URL"
        ];

        const scanId = `SCAN-${formData.assetTag || 'NA'}-${Date.now()}`;
        const auditDate = new Date().toISOString();
        const institution = "Partido State University";

        // Sort software so "Action Required" (is_licensed === false) comes first
        const sortedForExport = [...software].sort((a, b) => {
            if (a.is_licensed === b.is_licensed) return 0;
            return a.is_licensed ? 1 : -1;
        });

        const esc = (val: string | null | undefined) => `"${(val || '').replace(/"/g, '""')}"`;

        const csvRows = sortedForExport.map(s => [
            esc(scanId),
            esc(auditDate),
            esc(institution),
            esc(formData.assetTag),
            esc(formData.assignedUser),
            esc(formData.location),
            esc(formData.brandModel),
            esc(osStatus?.status || 'UNKNOWN'),
            esc(s.name),
            esc(s.version),
            esc(s.type),
            esc(s.license_required ? 'YES' : 'NO'),
            esc(s.is_licensed ? 'COMPLIANT' : 'ACTION REQUIRED'),
            esc(s.license_validity || 'Verification Required'),
            esc(s.compliance_note || ''),
            esc(s.alternative?.name || ''),
            esc(s.alternative?.url || '')
        ]);

        const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

        const sanitize = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').trim();
        const fileName = [
            'AUDIT',
            sanitize(formData.location || 'Unknown'),
            sanitize(formData.assignedUser || 'Unknown'),
            sanitize(formData.assetTag || 'Unknown'),
            new Date().toISOString().split('T')[0]
        ].filter(Boolean).join('-');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const requestSort = (key: keyof Software) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const sortedSoftware = [...software].sort((a, b) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig

        let aValue: any = a[key] || ''
        let bValue: any = b[key] || ''

        if (typeof aValue === 'boolean') {
            aValue = aValue ? 1 : 0
            bValue = bValue ? 1 : 0
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1
        if (aValue > bValue) return direction === 'asc' ? 1 : -1
        return 0
    })

    const getSortIcon = (key: keyof Software) => {
        if (sortConfig?.key !== key) return <ArrowUpAZ size={12} style={{ opacity: 0.2 }} />
        return sortConfig.direction === 'asc' ? <ChevronUp size={12} color="var(--primary)" /> : <ChevronDown size={12} color="var(--primary)" />
    }

    return (
        <div className="main-content" style={{ padding: '1rem', maxWidth: '1600px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <motion.header
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}>
                        <ShieldCheck size={28} color="white" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h1 style={{ margin: 0, fontSize: '1.6rem', lineHeight: 1.1, letterSpacing: '-0.03em' }}>CJSoftware License Checker</h1>
                                <span
                                    onClick={() => setIsChangelogOpen(true)}
                                    style={{
                                        fontSize: '0.6rem',
                                        background: 'var(--primary)',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '4px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        letterSpacing: '0.05em'
                                    }}
                                >
                                    V1.1.0
                                </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Created by: Charles Jasthyn C. De La Cueva
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
                        className="secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', borderRadius: '6px' }}
                    >
                        <MonitorPlay size={14} /> Welcome Tour
                    </button>
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', borderRadius: '6px' }}
                    >
                        <HelpCircle size={14} /> Help Guide
                    </button>
                    <button
                        onClick={() => {
                            if ((window as any).electron?.ipcRenderer) {
                                window.electron.ipcRenderer.invoke('check-for-updates')
                            } else {
                                window.postMessage({ type: 'simulate-update-message', data: { type: 'available', data: { version: '1.2.5' } } }, '*')
                            }
                        }}
                        className="secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', borderRadius: '6px' }}
                        title="Manual update check"
                    >
                        <RefreshCw size={14} /> Check for Updates
                    </button>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="secondary"
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px' }}
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                    {devices.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', marginLeft: '0.8rem' }}>
                            System Record: <strong>{devices[0].asset_tag}</strong> ({devices[0].assigned_user})
                        </div>
                    )}
                </div>
            </motion.header>

            {/* ─── Auto-Updater Banner ─── */}
            {updateStatus !== 'idle' && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 1.25rem',
                    background: updateStatus === 'downloaded' ? 'rgba(16,185,129,0.15)' :
                                updateStatus === 'error'      ? 'rgba(239,68,68,0.15)' :
                                                               'rgba(99,102,241,0.12)',
                    borderBottom: `1px solid ${
                        updateStatus === 'downloaded' ? 'rgba(16,185,129,0.3)' :
                        updateStatus === 'error'      ? 'rgba(239,68,68,0.3)' :
                        'rgba(99,102,241,0.3)'
                    }`,
                    fontSize: '0.78rem', gap: '0.75rem'
                }}>
                    <span style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {updateStatus === 'checking'     && <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Checking for updates...</>}
                        {updateStatus === 'not-available'&& <>✓ You are on the latest version.</>}
                        {updateStatus === 'available'    && <>🔔 Update v{updateInfo?.version} is available. Ready to download.</>}
                        {updateStatus === 'downloading'  && <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Downloading update... {updateInfo?.percent ?? 0}%</>}
                        {updateStatus === 'downloaded'   && <>✅ Update v{updateInfo?.version} downloaded. Restart to apply.</>}
                        {updateStatus === 'error'        && <>⚠️ Update error: {updateInfo?.error || 'Unknown error'}</>}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {updateStatus === 'available' && (
                            <button
                                className="btn-primary"
                                style={{ padding: '0.25rem 0.8rem', fontSize: '0.72rem' }}
                                onClick={() => window.electron.ipcRenderer.invoke('start-download')}
                            >Download</button>
                        )}
                        {updateStatus === 'downloaded' && (
                            <button
                                className="btn-primary"
                                style={{ padding: '0.25rem 0.8rem', fontSize: '0.72rem', background: 'var(--success)' }}
                                onClick={() => window.electron.ipcRenderer.invoke('quit-and-install')}
                            >Install &amp; Restart</button>
                        )}
                        {(updateStatus === 'available' || updateStatus === 'downloaded' || updateStatus === 'error') && (
                            <button
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => window.open('https://github.com/selrahcDC/cjsoftware-license-checker/releases', '_blank')}
                                title="Open GitHub Releases page in browser"
                            >🔗 GitHub Releases</button>
                        )}
                        <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1, padding: '0 0.2rem' }}
                            onClick={() => setUpdateStatus('idle')}
                            title="Dismiss"
                        >✕</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1rem', flex: 1, minHeight: 0 }}>
                {/* Left Column: Input & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    <motion.section
                        id="tour-computer-info"
                        className="card glass-panel"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ padding: '1.25rem' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Monitor size={18} /> Computer Info
                            </h2>
                            <button
                                onClick={handleResetForm}
                                className="secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                            >
                                <Trash2 size={12} /> Reset Form
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>Asset Tag / Property No.</label>
                                <input
                                    style={{ padding: '0.5rem 0.75rem' }}
                                    type="text"
                                    value={formData.assetTag}
                                    onChange={e => setFormData({ ...formData, assetTag: e.target.value })}
                                    placeholder="e.g. PC-2024"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>Assigned User</label>
                                <input
                                    style={{ padding: '0.5rem 0.75rem' }}
                                    type="text"
                                    value={formData.assignedUser}
                                    onChange={e => setFormData({ ...formData, assignedUser: e.target.value })}
                                    placeholder="e.g. Maria Clara"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>Brand & Model</label>
                                <input
                                    style={{ padding: '0.5rem 0.75rem' }}
                                    type="text"
                                    value={formData.brandModel}
                                    onChange={e => setFormData({ ...formData, brandModel: e.target.value })}
                                    placeholder="e.g. Dell Core i5"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>Location / Room</label>
                                <input
                                    style={{ padding: '0.5rem 0.75rem' }}
                                    type="text"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g. Server Room"
                                />
                            </div>
                        </div>
                    </motion.section>

                    <motion.section
                        id="tour-scan-button"
                        className={`card ${isScanning ? 'pulse' : ''}`}
                        style={{ textAlign: 'center', background: 'var(--glass)', border: `2px ${isScanning ? 'solid' : 'dashed'} var(--primary)`, padding: '1rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <button
                            onClick={runScan}
                            disabled={isScanning}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                fontSize: '1rem',
                                borderRadius: '12px',
                                justifyContent: 'center',
                                background: isScanning ? 'var(--bg-sidebar)' : 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                        >
                            {isScanning ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
                            {isScanning ? 'Deep Scanning System...' : 'Initiate Software Scan'}
                        </button>
                    </motion.section>

                    {osStatus ? (
                        <motion.section
                            id="tour-os-status"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card"
                            style={{
                                background: osStatus.status === 'CRACKED' ? 'rgba(239, 68, 68, 0.1)' : 'var(--glass)',
                                border: `1px solid ${osStatus.status === 'CRACKED' ? 'var(--error)' : 'var(--border)'}`,
                                padding: '1rem',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <Monitor size={20} color={osStatus.status === 'CRACKED' ? 'var(--error)' : 'var(--primary)'} />
                                <h3 style={{ margin: 0, fontSize: '0.85rem' }}>OS Security Health</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>OS:</span>
                                    <span style={{ fontWeight: 600 }}>{osStatus.osName}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                                    <span style={{ fontWeight: 700, color: osStatus.status === 'Normal' ? 'var(--success)' : 'var(--error)' }}>
                                        {osStatus.status === 'Normal' ? 'GENUINE' : osStatus.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem', border: '1px solid var(--border)' }}>
                                    {osStatus.note}
                                </div>

                                {officeStatus && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>MS Office</div>
                                            <span
                                                style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 700,
                                                    color: officeStatus.status === 'LICENSED' ? 'var(--success)' : 'var(--error)'
                                                }}
                                            >
                                                {officeStatus.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{officeStatus.note}</div>
                                    </div>
                                )}
                            </div>
                        </motion.section>
                    ) : null}

                    {software.length > 0 ? (
                        <button
                            id="tour-save-button"
                            onClick={handleSaveAndAudit}
                            disabled={isSaving || isScanning}
                            style={{
                                padding: '1rem',
                                width: '100%',
                                borderRadius: '12px',
                                background: 'var(--success)',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'SAVE ENTIRE AUDIT'}
                        </button>
                    ) : null}

                    {devices.length > 0 ? (
                        <div style={{ marginTop: 'auto' }}>
                            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Saved Audits</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {devices.slice(0, 3).map(device => (
                                    <div key={device.id} className="card glass-panel" style={{ padding: '0.75rem', fontSize: '0.75rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {device.asset_tag}
                                                <span style={{ opacity: 0.6, fontWeight: 400, fontSize: '0.6rem' }}>
                                                    {device.created_at ? new Date(device.created_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)' }}>{device.assigned_user}</div>
                                        </div>
                                        <button
                                            onClick={() => device.id && handleDeleteDevice(device.id)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', padding: '0.25rem', cursor: 'pointer', marginLeft: '0.5rem' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Right Column: Results Table */}
                <motion.section
                    id="tour-results-table"
                    className="card glass-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', margin: 0 }}
                >
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <AlertCircle size={20} color="var(--primary)" />
                            <h2 style={{ fontSize: '1rem', margin: 0 }}>Detected Software Inventory ({software.length})</h2>
                        </div>
                        {software.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                    onClick={handleExportCSV}
                                    className="secondary"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem' }}
                                >
                                    <Download size={14} /> Export CSV
                                </button>
                                <span className="badge badge-error">{software.filter(s => !s.is_licensed).length} Alerts</span>
                                <span className="badge badge-success">{software.filter(s => s.is_licensed).length} OK</span>
                            </div>
                        )}
                    </div>

                    <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <tr>
                                    <th onClick={() => requestSort('name')} style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', width: '32%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Software Details {getSortIcon('name')}</div>
                                    </th>
                                    <th onClick={() => requestSort('is_licensed')} style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: '13%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Status {getSortIcon('is_licensed')}</div>
                                    </th>
                                    <th onClick={() => requestSort('license_validity')} style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: '18%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Validity {getSortIcon('license_validity')}</div>
                                    </th>
                                    <th onClick={() => requestSort('compliance_note')} style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', width: '37%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Note & Recommendation {getSortIcon('compliance_note')}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSoftware.map((sw, i) => (
                                    <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.8rem 0.6rem', verticalAlign: 'top' }}>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                {sw.icon ? (
                                                    <img
                                                        src={sw.icon}
                                                        style={{ width: '32px', height: '32px', borderRadius: '6px', marginTop: '0.2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                        alt=""
                                                    />
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', background: 'var(--border)', borderRadius: '6px', marginTop: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Package size={18} color="var(--text-muted)" />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sw.name}>
                                                        {sw.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', gap: '0.5rem' }}>
                                                        <span>v{sw.version}</span>
                                                        <span>•</span>
                                                        <span style={{ opacity: 0.8 }}>{sw.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.8rem 0.6rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                            <span
                                                className={`badge ${sw.is_licensed && sw.type !== 'Third-Party App' ? 'badge-success' : sw.is_licensed ? 'badge-warning' : 'badge-error'}`}
                                                style={{ fontSize: '0.65rem', padding: '0.3rem 0.6rem', fontWeight: 700 }}
                                            >
                                                {!sw.is_licensed ? '⚠️ Action Req.' : sw.type === 'Third-Party App' ? '◎ Verify' : '✓ OK'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 0.6rem', verticalAlign: 'top', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: sw.license_validity?.toLowerCase().includes('permanent') || sw.license_validity?.toLowerCase().includes('licensed') ? 'var(--success)' : 'var(--warning)',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {sw.license_validity || 'Check Req.'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 0.6rem', fontSize: '0.75rem', color: sw.is_licensed ? 'var(--text-muted)' : 'var(--error)', wordBreak: 'break-word', verticalAlign: 'top' }}>
                                            <div style={{ marginBottom: sw.alternative ? '0.6rem' : 0, lineHeight: 1.4, fontWeight: 500 }}>{sw.compliance_note}</div>
                                            {sw.alternative && (
                                                <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.3rem', fontSize: '0.65rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem', fontStyle: 'normal' }}>
                                                        <PlusCircle size={12} /> Suggested Alternative:
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontStyle: 'normal' }}>
                                                        <span style={{ color: 'var(--text-main)', fontSize: '0.75rem' }}>Use</span>
                                                        <a href={sw.alternative.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 900, textDecoration: 'underline', fontSize: '0.85rem' }}>
                                                            {sw.alternative.name}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {isScanning && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '10rem 2rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.03)' }}>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.3 }}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                                                    <RefreshCw className="spin" size={64} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.2 }}></div>
                                                </div>
                                                <div style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 600, letterSpacing: '0.05em' }}>
                                                    Deep Scanning System...
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem', maxWidth: '400px', margin: '0.75rem auto 0' }}>
                                                    Analyzing application signatures, checking host integrity, and verifying license compliance across your system.
                                                </div>
                                            </motion.div>
                                        </td>
                                    </tr>
                                )}
                                {software.length === 0 && !isScanning && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                                            <Search size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                            <div>No data to display. Please run a scan.</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.section>
            </div>
            {/* Changelog Modal */}
            <AnimatePresence>
                {isChangelogOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsChangelogOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="card"
                            style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: '500px',
                                maxHeight: '80vh',
                                overflowY: 'auto',
                                background: 'var(--bg-sidebar)',
                                border: '1px solid var(--primary)',
                                textAlign: 'left',
                                padding: '2rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <History size={20} color="var(--primary)" /> Changelog & History
                                </h2>
                                <button onClick={() => setIsChangelogOpen(false)} style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <XCircle size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ background: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>v1.1.0</span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Office Crack Detection & Scan Hardening</span>
                                    </div>
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                                        <li><strong>Office Crack Detection (macOS)</strong>: Detects VL Serializer license injection — the most common macOS Office crack.</li>
                                        <li><strong>Microsoft 365 License Verification</strong>: Distinguishes a real M365 subscription from cracked activation.</li>
                                        <li><strong>Windows Office Check</strong>: Uses <code>ospp.vbs</code> to verify Office activation status on Windows.</li>
                                        <li><strong>Windows Hardening</strong>: KMS service detection now correctly parses JSON; expanded crack tool paths.</li>
                                        <li><strong>Scan Coverage</strong>: Now also scans <code>~/Applications/</code> for user-level macOS app installs.</li>
                                        <li><strong>CSV Export Upgraded</strong>: Added <em>Compliance_Note</em>, <em>License_Required</em>, <em>Recommended_Alternative</em>, and <em>Alternative_URL</em> columns. UTF-8 BOM added for Excel compatibility.</li>
                                        <li><strong>14 Bug Fixes</strong>: Fixed false positives (AnyDesk, TeamViewer, Chrome Beta), duplicate keywords, trailing-space keyword bugs, and Gatekeeper/Office check priority.</li>
                                        <li><strong>UI</strong>: Third-Party Apps now show a neutral <em>&#9678; Verify</em> badge instead of a misleading green ✓ OK.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ background: 'var(--glass)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>v1.0.0</span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Initial Official Release</span>
                                    </div>
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                                        <li><strong>Auto-Update System</strong>: Integrated GitHub releases for seamless in-app updates.</li>
                                        <li><strong>Enhanced Detection</strong>: Database expanded to 150+ software brands.</li>
                                        <li><strong>Deep Scan Engine</strong>: Detects cracked software, broken signatures, and activation blocks.</li>
                                        <li><strong>Pro Export</strong>: Added full Metadata (Asset Tag, User, Location) to CSV reports.</li>
                                        <li><strong>Premium UI</strong>: Implemented dark/light themes and modern glassmorphism aesthetic.</li>
                                        <li><strong>Smart Sorting</strong>: Priority sorting for non-compliant software.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ background: 'var(--glass)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>v0.1.0</span>
                                    </div>
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        <li>Added license classifications (Commercial, Free, Utility).</li>
                                        <li>Source Verification: Recognition of Mac App Store & Identified Developers.</li>
                                        <li>Added "Reason / Note" column to inventory table.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ background: 'var(--glass)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>v0.0.1</span>
                                    </div>
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        <li>Initial release with core scanning engine.</li>
                                        <li>Local SQLite database integration for saving audits.</li>
                                        <li>Asset Tagging and User Management system.</li>
                                    </ul>
                                </section>

                                <section style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Open Source License</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                                        This software is now **Open Source** and released under the **MIT License**. It is provided as-is for the benefit of the community and educational institutions like **Partido State University**.
                                    </p>
                                    <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: 600 }}>
                                        © 2026 Charles Jasthyn C. De La Cueva. Licensed under MIT.
                                    </div>
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <button
                                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.72rem', padding: '0.3rem 0.75rem', fontWeight: 600 }}
                                            onClick={() => window.open('https://github.com/selrahcDC/cjsoftware-license-checker/releases', '_blank')}
                                        >
                                            🔗 View All Releases on GitHub
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Help & User Guide Modal */}
            <AnimatePresence>
                {isHelpOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHelpOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="card"
                            style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: '700px',
                                maxHeight: '85vh',
                                overflowY: 'auto',
                                background: 'var(--bg-sidebar)',
                                border: '1px solid var(--primary)',
                                textAlign: 'left',
                                padding: '2.5rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
                                    <BookOpen size={28} color="var(--primary)" /> How to Use & Interpret Results
                                </h1>
                                <button onClick={() => setIsHelpOpen(false)} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <section>
                                    <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ background: 'var(--primary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>1</div>
                                        Data Entry (Computer Info)
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        Before scanning, you must fill out the <strong>Computer Info</strong> section. This identifies who the equipment belongs to and its physical location.
                                        <ul style={{ marginTop: '0.5rem' }}>
                                            <li><strong>Asset Tag</strong>: The unique property number assigned by PSU.</li>
                                            <li><strong>Assigned User</strong>: The person currently using the workstation.</li>
                                        </ul>
                                    </p>
                                </section>

                                <section>
                                    <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ background: 'var(--primary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>2</div>
                                        Initiating a Deep Scan
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        Click <strong>"Initiate Software Scan"</strong>. The system will perform several checks:
                                        <ul style={{ marginTop: '0.5rem' }}>
                                            <li><strong>Inventory</strong>: Listing all user-installed applications.</li>
                                            <li><strong>Heuristics</strong>: Matching names against a database of 150+ brands.</li>
                                            <li><strong>Deep Scan</strong>: Verifying digital signatures and system integrity for potential cracks or bypasses.</li>
                                        </ul>
                                    </p>
                                </section>

                                <section>
                                    <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ background: 'var(--primary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>3</div>
                                        Interpreting the Compliance Results
                                    </h3>
                                    <div style={{ display: 'grid', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span className="badge badge-success" style={{ minWidth: '120px', textAlign: 'center' }}>✓ Licensed</span>
                                            <span style={{ fontSize: '0.8rem' }}>Software is confirmed as <strong>Free</strong>, <strong>App Store verified</strong>, or a <strong>signed Third-Party</strong> app.</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span className="badge badge-error" style={{ minWidth: '120px', textAlign: 'center' }}>⚠️ Action Required</span>
                                            <span style={{ fontSize: '0.8rem' }}>Software is classified as <strong>Paid/Commercial</strong>. You must manually verify if a valid license key or subscription exists.</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span className="badge badge-error" style={{ minWidth: '120px', textAlign: 'center', background: 'var(--error)', color: 'white' }}>⚠️ CRACKED</span>
                                            <span style={{ fontSize: '0.8rem' }}><strong>CRITICAL</strong>: The Deep Scan found evidence of tampering, broken signatures, or activation blockers. These must be removed immediately.</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ background: 'var(--primary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>4</div>
                                        Saving & Professional Export
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        Once the scan is complete:
                                        <ol style={{ marginTop: '0.5rem' }}>
                                            <li>Click <strong>"Save Entire Audit"</strong> to log the data in the local database.</li>
                                            <li>Use the <strong>"Export CSV"</strong> button on the results table to generate a formal report. The filename will automatically include the Asset Tag and Location for easy organization.</li>
                                        </ol>
                                    </p>
                                </section>
                            </div>

                            <button
                                onClick={() => setIsHelpOpen(false)}
                                style={{ marginTop: '2.5rem', width: '100%', background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                            >
                                I Understand, Let's Start
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <footer style={{ marginTop: '1.5rem', textAlign: 'center', opacity: 0.4, fontSize: '0.65rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ marginBottom: '0.25rem' }}>© 2026 Charles Jasthyn C. De La Cueva | Licensed under MIT</div>
                <div>Open Source Software provided for community benefit and <strong>Partido State University</strong></div>
            </footer>
            {/* Interactive Onboarding Tour Overlay */}
            <AnimatePresence>
                {showOnboarding && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 110, pointerEvents: 'none' }}>
                        {/* Dimming Overlay with Dynamic Spotlight Cutout */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(2px)',
                                pointerEvents: 'auto',
                                clipPath: (() => {
                                    const ids = ['tour-computer-info', 'tour-scan-button', 'tour-results-table', 'tour-os-status', 'tour-save-button'];
                                    const el = document.getElementById(ids[onboardingStep - 1]);
                                    if (!el || onboardingStep === 0) return 'none';
                                    const rect = el.getBoundingClientRect();
                                    const p = 12; // padding around the spotlight
                                    return `polygon(
                                        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 
                                        ${rect.left - p}px ${rect.top - p}px, 
                                        ${rect.left - p}px ${rect.bottom + p}px, 
                                        ${rect.right + p}px ${rect.bottom + p}px, 
                                        ${rect.right + p}px ${rect.top - p}px, 
                                        ${rect.left - p}px ${rect.top - p}px
                                    )`;
                                })()
                            }}
                        />

                        {/* Interactive Tour Bubble - Positions itself based on the target */}
                        <motion.div
                            key={onboardingStep}
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                top: (() => {
                                    if (onboardingStep === 0) return '50%';
                                    const ids = ['tour-computer-info', 'tour-scan-button', 'tour-results-table', 'tour-os-status', 'tour-save-button'];
                                    const el = document.getElementById(ids[onboardingStep - 1]);
                                    if (!el) return '50%';
                                    const rect = el.getBoundingClientRect();
                                    if (onboardingStep === 3) return '50%'; // Center for table
                                    // Clamp to prevent bottom cutoff (Bubble is ~260px tall, so max top should be windowHeight - 150)
                                    const rawTop = rect.top + (rect.height / 2);
                                    return Math.min(Math.max(100, rawTop), window.innerHeight - 200);
                                })(),
                                left: (() => {
                                    if (onboardingStep === 0) return '50%';
                                    const ids = ['tour-computer-info', 'tour-scan-button', 'tour-results-table', 'tour-os-status', 'tour-save-button'];
                                    const el = document.getElementById(ids[onboardingStep - 1]);
                                    if (!el) return '50%';
                                    const rect = el.getBoundingClientRect();
                                    if (onboardingStep === 3) return '50%'; // Center for table
                                    return rect.right + 40;
                                })(),
                                x: onboardingStep === 0 || onboardingStep === 3 ? '-50%' : '0',
                                y: onboardingStep === 0 || onboardingStep === 3 ? '-50%' : '-50%'
                            }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'absolute',
                                width: '380px',
                                background: 'var(--bg-sidebar)',
                                border: '2px solid var(--primary)',
                                borderRadius: '20px',
                                padding: '2rem',
                                zIndex: 120,
                                pointerEvents: 'auto',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'var(--primary)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800 }}>
                                    {onboardingStep}
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                    {onboardingStep === 0 ? 'Welcome Tour' : 'Interface Guide'}
                                </h4>
                            </div>

                            <div style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 400 }}>
                                {onboardingStep === 0 && "Welcome to the CJ Software Checker. This guided tour will point out the key features of the system."}
                                {onboardingStep === 1 && "Start here: This section is for identification. You must enter the Asset Tag and Assigned User before initiating any scan."}
                                {onboardingStep === 2 && "The Core Engine: Click this to perform a 'Deep Scan'. It verifies application signatures and flags unauthorized commercial software."}
                                {onboardingStep === 3 && "The Audit List: All results appear in this sortable table. Red rows indicate software that requires license verification or action."}
                                {onboardingStep === 4 && "Security Center: This critical panel monitors the Operating System itself, flagging potential Windows cracks or unlicensed kernels."}
                                {onboardingStep === 5 && "Documentation: Once happy with the scan, save the snapshot to the database. Professional CSV exports are available in the table header."}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                <button
                                    onClick={() => setShowOnboarding(false)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Exit Tour
                                </button>

                                <button
                                    onClick={() => {
                                        if (onboardingStep < 5) {
                                            setOnboardingStep(s => s + 1);
                                        } else {
                                            localStorage.setItem('cj_checker_onboarded', 'true');
                                            setShowOnboarding(false);
                                        }
                                    }}
                                    style={{ background: 'var(--primary)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                >
                                    {onboardingStep === 5 ? 'Finish' : 'Next Step'} <ArrowRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <UpdateNotifier />
        </div>
    )
}

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                invoke: (channel: string, ...args: any[]) => Promise<any>
            }
        }
    }
}
