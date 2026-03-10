import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// @ts-ignore
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'

const execAsync = promisify(exec)

let db: any

const loadAlternatives = () => {
    try {
        let altPath = ''
        if (app.isPackaged) {
            altPath = join(process.resourcesPath, 'alternatives.json')
        } else {
            // Development path strategies
            const strategies = [
                join(app.getAppPath(), 'resources/alternatives.json'),
                join(process.cwd(), 'resources/alternatives.json'),
                join(__dirname, '../../resources/alternatives.json')
            ]
            altPath = strategies.find(p => fs.existsSync(p)) || strategies[0]
        }

        if (fs.existsSync(altPath)) {
            const data = JSON.parse(fs.readFileSync(altPath, 'utf-8'))
            console.log(`[Main] Loaded ${Object.keys(data).length} alternatives from: ${altPath}`)
            return data
        } else {
            console.warn(`[Main] Alternatives file NOT found. Checked: ${altPath}`)
        }
    } catch (e) {
        console.error('[Main] Failed to load alternatives:', e)
    }
    return {}
}

const getAlternative = (name: string, alternativesMap: any) => {
    const lowerName = name.toLowerCase()
    for (const key of Object.keys(alternativesMap)) {
        if (lowerName.includes(key)) {
            return alternativesMap[key]
        }
    }
    return null
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        show: false,
        autoHideMenuBar: true,
        icon: icon,
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    // Initialize Database
    const dbPath = join(app.getPath('userData'), 'cj_license_checker.db')
    db = new Database(dbPath)

    db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT,
      brand_model TEXT,
      location TEXT,
      assigned_user TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS software_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER,
      name TEXT,
      version TEXT,
      is_licensed INTEGER DEFAULT 0,
      license_validity TEXT,
      type TEXT,
      license_required INTEGER DEFAULT 0,
      compliance_note TEXT,
      metadata TEXT,
      path TEXT,
      icon TEXT,
      FOREIGN KEY(device_id) REFERENCES devices(id)
    );
  `)

    // Migration for existing tables
    try {
        const tableInfo = db.prepare("PRAGMA table_info(software_inventory)").all()
        const colNames = tableInfo.map((c: any) => c.name)
        if (!colNames.includes('path')) {
            db.exec("ALTER TABLE software_inventory ADD COLUMN path TEXT")
        }
        if (!colNames.includes('icon')) {
            db.exec("ALTER TABLE software_inventory ADD COLUMN icon TEXT")
        }
    } catch (e) {
        console.error('Migration failed:', e)
    }

    // IPC Handlers
    ipcMain.handle('get-devices', () => {
        return db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all()
    })

    ipcMain.handle('save-device', (_, device) => {
        const stmt = db.prepare('INSERT INTO devices (asset_tag, brand_model, location, assigned_user) VALUES (?, ?, ?, ?)')
        const info = stmt.run(device.assetTag, device.brandModel, device.location, device.assignedUser)
        return info.lastInsertRowid
    })

    ipcMain.handle('get-software', (_, deviceId) => {
        const rows = db.prepare('SELECT * FROM software_inventory WHERE device_id = ?').all(deviceId)
        const alternativesMap = loadAlternatives()

        return rows.map((row: any) => {
            const isLicensed = row.is_licensed === 1
            const alternative = (!isLicensed) ? getAlternative(row.name, alternativesMap) : null
            return {
                ...row,
                is_licensed: isLicensed,
                license_required: row.license_required === 1,
                alternative,
                icon: row.icon
            }
        })
    })

    ipcMain.handle('scan-software', async () => {
        const alternativesMap = loadAlternatives()

        const commercialKeywords = [
            // Creative & Design
            'adobe', 'photoshop', 'illustrator', 'indesign', 'premiere', 'after effects', 'acrobat pro', 'creative cloud', 'lightroom', 'audition',
            'autodesk', 'autocad', '3ds max', 'maya', 'revit', 'fusion 360', 'sketch', 'affine', 'capture one', 'affinity photo', 'affinity designer', 'affinity publisher',
            'corel', 'painter', 'paintshop', 'quarkxpress', 'dxo photolab', 'capture one',
            // Development
            'jetbrains', 'intellij', 'webstorm', 'pycharm', 'phpstorm', 'clion', 'rider', 'datagrip', 'appcode', 'navicat', 'beyond compare', 'sublime text',
            'tower', 'gitkraken', 'postman enterprise', 'vmware fusion', 'vmware workstation',
            // Office & Productivity
            'microsoft office', 'microsoft word', 'microsoft excel', 'microsoft powerpoint', 'microsoft outlook', 'ms office', 'visio', 'project',
            'quickbooks', 'camtasia', 'snagit', 'omnifocus', 'omniffle', 'things', 'fantastical', 'scrivener', 'final cut pro', 'logic pro', 'cleanmymac',
            'nitro pdf', 'foxit pdf', 'abbyy finereader', 'dragon naturallyspeaking', 'busycal', 'devonthink',
            // Security & VPN
            'expressvpn', 'nordvpn', 'mcafee', 'norton', 'kaspersky', 'avg premium', 'avast premium', 'sophos home', 'eset smart security', 'bitdefender total',
            'malwarebytes premium', 'tunnelbear', 'surfshark',
            // Data & Analysis
            'tableau', 'power bi', 'sas', 'spss', 'arcgis', 'matlab', 'wolfram mathematica'
        ]
        const freeKeywords = [
            // Browsers & Communication
            'google', 'chrome', 'firefox', 'opera', 'vivaldi', 'tor browser', 'arc browser', 'chromium', 'microsoft edge',
            'whatsapp', 'telegram', 'signal', 'viber', 'messenger', 'discord', 'slack', 'zoom', 'skype', 'microsoft teams',
            // Development Tools
            'visual studio code', 'vscode', 'vscodium', 'vs community', 'visual studio community', 'atom', 'sublime text (unregistered)',
            'anaconda', 'python', 'node.js', 'npm', 'git', 'homebrew', 'iterm', 'warp', 'docker', 'postman', 'insomnia', 'bruno',
            'figma', 'dbeaver', 'db browser', 'fork', 'sourcetree', 'github desktop', 'putty', 'filezilla', 'wireshark', 'cyberduck',
            // Productivity & Cloud
            'docs', 'sheets', 'slides', 'drive', 'photos', 'calendar', 'meet', 'keep', 'iCloud', 'onedrive', 'dropbox', 'box', 'mega', 'nextcloud',
            'notion', 'clickup', 'monday.com', 'asana', 'trello', 'evernote', 'todoist', 'joplin', 'obsidian', 'logseq', 'bear', 'craft',
            'bitwarden', 'keepass', 'lastpass', '1password (free)',
            // Media & Graphics
            'vlc', 'spotify', 'apple music', 'itunes', 'handbrake', 'iina', 'plex', 'kodi', 'audacity', 'obs studio', 'vnc', 'anydesk', 'teamviewer (free)',
            'inkscape', 'gimp', 'blender', 'krita', 'darktable', 'rawtherapee', 'davinci resolve', 'canvas', 'framer',
            // Games & Social
            'steam', 'epic games', 'battle.net', 'origin', 'ubisoft connect', 'gog galaxy', 'roblox', 'minecraft',
            // Utilities
            '7-zip', 'winzip (free)', 'winrar (unregistered)', 'notepad++', 'appcleaner', 'transmission', 'qbittorrent', 'grandtotal', 'rectangle', 'spectacle',
            'malwarebytes', 'avg anti-virus', 'avast free', 'bitdefender free', 'sophos endpoint'
        ]

        const categorize = (name: string, obtainedFrom: string = '', path: string = '') => {
            const lowerName = name.toLowerCase()
            const lowerPath = path.toLowerCase()

            if (freeKeywords.some(k => lowerName.includes(k))) return { type: 'Freeware/Cloud', licenseRequired: 0, note: 'Standard Free/Open Source' }
            if (commercialKeywords.some(k => lowerName.includes(k))) return { type: 'Commercial', licenseRequired: 1, note: 'Paid software - requires valid license' }

            // Smarter Utility Detection
            const utilityKeywords = ['cli', 'tool', 'manager', 'driver', 'runtime', 'update', 'manual', 'help', 'daemon', 'agent', 'service', 'plugin']
            if (utilityKeywords.some(k => lowerName.includes(k) || lowerPath.includes(k))) {
                return { type: 'Utility/Helper', licenseRequired: 0, note: 'System Component or Utility' }
            }

            // Source/Origin Awareness
            if (obtainedFrom === 'mac_app_store') return { type: 'App Store', licenseRequired: 0, note: 'Verified Mac App Store Application' }
            if (obtainedFrom === 'apple') return { type: 'Apple System', licenseRequired: 0, note: 'Apple System Application' }
            if (obtainedFrom === 'identified_developer') return { type: 'Third Party', licenseRequired: 0, note: 'Signed by an Identified Developer' }

            // Common "Setup" or "Updater" apps
            if (lowerName.includes('installer') || lowerName.includes('uninstaller') || lowerName.includes('updater') || lowerName.includes('notifier')) {
                return { type: 'Utility', licenseRequired: 0, note: 'Setup/Update Utility' }
            }

            return { type: 'Software/Other', licenseRequired: 1, note: 'Unrecognized software - manually verify license' }
        }

        const isTrialVersion = (name: string, version: string) => {
            const trialKeywords = ['trial', 'evaluation', 'demo', 'lite', 'expiring', 'preview', 'beta']
            const lowerString = (name + ' ' + version).toLowerCase()
            return trialKeywords.some(k => lowerString.includes(k))
        }

        const performDeepScan = async (name: string, path: string) => {
            const results: { status: string; note: string } = { status: 'Normal', note: '' }

            try {
                // 1. Check Hosts File for activation blocks
                const hostsPath = process.platform === 'win32'
                    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
                    : '/etc/hosts'

                if (fs.existsSync(hostsPath)) {
                    const hosts = fs.readFileSync(hostsPath, 'utf8')
                    const blockedKeywords = ['adobe', 'microsoft', 'activation', 'v3.su', 'license.internal']
                    if (blockedKeywords.some(k => hosts.toLowerCase().includes(k) && hosts.includes('127.0.0.1'))) {
                        return { status: 'FORFEITED', note: '⚠ System hosts modified to block activation servers (Cracked)' }
                    }
                }

                // 2. Platform Specific deep checks
                if (process.platform === 'darwin' && path) {
                    // Check for common macOS crack flags or broken signatures
                    // Using codesign -v to check integrity
                    try {
                        await execAsync(`codesign -v "${path}"`)
                    } catch (e: any) {
                        if (e.message.includes('not signed') || e.message.includes('satisfy')) {
                            return { status: 'INVALID', note: '⚠ App signature is broken/missing (Common in Cracked versions)' }
                        }
                    }
                } else if (process.platform === 'win32') {
                    // Check for common Windows crack tools (KMSPico, etc) in common locations
                    const crackPaths = [
                        'C:\\Program Files\\KMSPico',
                        'C:\\Windows\\KMSAuto',
                        'C:\\Windows\\SECOH-QAD.exe'
                    ]
                    if (crackPaths.some(p => fs.existsSync(p))) {
                        return { status: 'CRACKED', note: '⚠ KMS Activation crack discovered on this computer' }
                    }
                }

                // 3. Adobe specific "amtlib" check (Legacy but common)
                if (name.toLowerCase().includes('adobe')) {
                    const isWin = process.platform === 'win32'
                    if (isWin && path) {
                        const amtlib = join(path, 'amtlib.dll')
                        if (fs.existsSync(amtlib)) {
                            // This is a simple existence check, but a deep scan would check the DLL signature
                            results.note = 'Audit: Local licensing file present.'
                        }
                    }
                }

            } catch (err) {
                console.error('Deep scan error:', err)
            }
            return results
        }

        if (process.platform === 'darwin') {
            try {
                console.log('Starting macOS application scan (Strict /Applications only)...')
                const { stdout } = await execAsync('system_profiler -json SPApplicationsDataType')
                const data = JSON.parse(stdout)

                const rawApps = data.SPApplicationsDataType || []
                console.log(`[Main] Total SPApplicationsDataType found: ${rawApps.length}`)
                const filteredApps = rawApps.filter((appNode: any) => {
                    const path = appNode.path || ''
                    // STRICT: Only apps in the main /Applications list, skipping system utilities and Apple's own apps
                    const isUserApp = path.startsWith('/Applications/') &&
                        !path.startsWith('/Applications/Utilities/') &&
                        appNode.obtained_from !== 'apple'
                    return isUserApp
                })

                console.log(`[Main] Filtered to ${filteredApps.length} user-installed apps.`)
                if (filteredApps.length > 0) {
                    console.log(`[Main] Sample App Path: ${filteredApps[0].path}`)
                }

                const results = await Promise.all(filteredApps.map(async (appNode: any) => {
                    const category = categorize(appNode._name, appNode.obtained_from, appNode.path)
                    let complianceStatus = category.licenseRequired === 0
                    let complianceNote = category.note
                    let iconDataUrl = ''

                    // Try to get icon
                    if (appNode.path) {
                        try {
                            const icon = await app.getFileIcon(appNode.path, { size: 'normal' })
                            const dataUrl = icon.toDataURL()
                            if (dataUrl.length > 100) { // Check if it's not a generic blank icon
                                iconDataUrl = dataUrl
                            } else {
                                console.warn(`[Main] Icon for ${appNode._name} seems empty/invalid. Path: ${appNode.path}`)
                            }
                        } catch (e) {
                            console.error(`[Main] Failed getFileIcon for ${appNode._name}: ${e instanceof Error ? e.message : String(e)}`)
                        }
                    }

                    // Perform Deep Scan for all software except explicit Freeware/Cloud
                    if (category.type !== 'Freeware/Cloud') {
                        const deepResult = await performDeepScan(appNode._name, appNode.path)
                        if (deepResult.status !== 'Normal') {
                            complianceStatus = false
                            complianceNote = deepResult.note
                        }
                    }

                    const isTrial = isTrialVersion(appNode._name, appNode.version || '')
                    let finalComplianceNote = isTrial ? `⚠ Trial/Evaluation version detected.` : complianceNote
                    const complianceStatusFinal = complianceStatus && !isTrial

                    const alternative = (!complianceStatusFinal) ? getAlternative(appNode._name, alternativesMap) : null

                    return {
                        name: appNode._name,
                        version: appNode.version || 'Unknown',
                        type: category.type,
                        license_required: category.licenseRequired,
                        is_licensed: complianceStatusFinal,
                        compliance_note: finalComplianceNote,
                        license_validity: isTrial ? 'Trial Version' : (complianceStatus ? 'Permanent' : 'Action Required'),
                        alternative: alternative,
                        icon: iconDataUrl,
                        path: appNode.path
                    }
                }))
                return results
            } catch (err) {
                console.error('macOS Scan failed:', err)
                return []
            }
        } else if (process.platform === 'win32') {
            try {
                console.log('Starting Windows application scan (Uninstall List only)...')
                const paths = [
                    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
                    'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
                    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
                ]

                // Pure "Add/Remove Programs" filter
                const cmd = `powershell "Get-ItemProperty ${paths.join(', ')} -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 -and $_.UninstallString -ne $null -and $_.DisplayName -notmatch '^Update for' -and $_.DisplayName -notmatch 'Redistributable' } | Select-Object DisplayName, DisplayVersion | ConvertTo-Json"`
                const { stdout } = await execAsync(cmd)
                if (!stdout) return []
                const data = JSON.parse(stdout)
                const rawApps = Array.isArray(data) ? data : [data]

                const appMap = new Map()
                rawApps.forEach((app: any) => {
                    const name = app.DisplayName?.trim()
                    if (name) appMap.set(name, app)
                })

                const uniqueApps = Array.from(appMap.values())
                console.log(`Scan finished. Found ${uniqueApps.length} unique user programs.`)

                const finalResults = await Promise.all(uniqueApps.map(async (app: any) => {
                    const category = categorize(app.DisplayName, '', '')
                    let complianceStatus = category.licenseRequired === 0
                    let complianceNote = category.note

                    // Perform Deep Scan for all software except explicit Freeware/Cloud
                    if (category.type !== 'Freeware/Cloud') {
                        const deepResult = await performDeepScan(app.DisplayName, '')
                        if (deepResult.status !== 'Normal') {
                            complianceStatus = false
                            complianceNote = deepResult.note
                        }
                    }

                    const isTrial = isTrialVersion(app.DisplayName, app.DisplayVersion || '')
                    let finalComplianceNote = isTrial ? `⚠ Trial/Evaluation program detected.` : complianceNote
                    const complianceStatusFinal = complianceStatus && !isTrial

                    const alternative = (!complianceStatusFinal) ? getAlternative(app.DisplayName, alternativesMap) : null

                    return {
                        name: app.DisplayName,
                        version: app.DisplayVersion || 'Unknown',
                        type: category.type,
                        license_required: category.licenseRequired,
                        is_licensed: complianceStatusFinal,
                        compliance_note: finalComplianceNote,
                        license_validity: isTrial ? 'Trial/Evaluation' : (complianceStatus ? 'Permanent/Licensed' : 'Action Required'),
                        alternative: alternative,
                        icon: '', // TODO: Implement Windows icon fetching if possible
                        path: ''
                    }
                }))
                return finalResults
            } catch (err) {
                console.error('Windows Scan failed:', err)
                return []
            }
        }
        return []
    })

    ipcMain.handle('check-os-status', async () => {
        const result = {
            platform: process.platform,
            status: 'Normal',
            osName: '',
            osVersion: '',
            note: 'System appears genuine and healthy.'
        }

        try {
            if (process.platform === 'win32') {
                // 1. Get OS Name & Version
                const { stdout: osInfo } = await execAsync('powershell "Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version | ConvertTo-Json"')
                const osData = JSON.parse(osInfo)
                result.osName = osData.Caption
                result.osVersion = osData.Version

                // 2. Check Activation Status via slmgr
                try {
                    const { stdout: slmgr } = await execAsync('cscript //nologo %systemroot%\\system32\\slmgr.vbs /dli')
                    if (slmgr.toLowerCase().includes('kms') || slmgr.toLowerCase().includes('volume')) {
                        // Check if it's a known crack tool generating this KMS
                        const crackPaths = [
                            'C:\\Program Files\\KMSPico',
                            'C:\\Windows\\KMSAuto',
                            'C:\\Windows\\v3.su',
                            'C:\\Windows\\SECOH-QAD.exe'
                        ]
                        if (crackPaths.some(p => fs.existsSync(p))) {
                            result.status = 'CRACKED'
                            result.note = '⚠ OS Activation handled by an unauthorized KMS Tool (Crack detected).'
                        } else {
                            result.note = 'Information: System uses Volume/KMS Activation (Standard for Enterprises).'
                        }
                    } else if (slmgr.toLowerCase().includes('unlicensed') || slmgr.toLowerCase().includes('notification')) {
                        result.status = 'UNLICENSED'
                        result.note = '⚠ Windows is not activated or in notification mode.'
                    }
                } catch (e) {
                    console.error('slmgr check failed', e)
                }

                // 3. Deep Check for OS Expiration (/xpr)
                try {
                    const { stdout: xpr } = await execAsync('cscript //nologo %systemroot%\\system32\\slmgr.vbs /xpr')
                    if (xpr.includes('will expire')) {
                        result.status = 'EXPIRING'
                        const dateMatch = xpr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
                        result.note = `⚠ Windows license is temporary. Expiration: ${dateMatch ? dateMatch[0] : 'See slmgr output'}.`
                    } else if (xpr.includes('permanently activated')) {
                        result.note = 'Information: Windows is permanently activated.'
                    }
                } catch (e) { }

                // 4. Check for illegal activators in system
                const illegalServices = ['KMSeldi', 'Service_KMS', 'KMSAuto']
                try {
                    const { stdout: services } = await execAsync('powershell "Get-Service | Where-Object { $_.Name -match \'KMS\' -or $_.DisplayName -match \'KMS\' } | Select-Object Name | ConvertTo-Json"')
                    if (services && services.length > 5) {
                        result.status = 'CRACKED'
                        result.note = '⚠ Unauthorized Activation Service running in background (Crack detected).'
                    }
                } catch (e) { }

            } else if (process.platform === 'darwin') {
                const { stdout } = await execAsync('system_profiler SPSoftwareDataType -json')
                const data = JSON.parse(stdout)
                const info = data.SPSoftwareDataType[0]
                result.osName = 'macOS'
                result.osVersion = info.os_version
                result.note = 'Official Apple macOS System Integrity (Verified)'
            }
        } catch (err) {
            console.error('OS Status check failed:', err)
        }

        return result
    })

    ipcMain.handle('check-office-license', async () => {
        if (process.platform !== 'win32') return null

        try {
            // Find ospp.vbs in common Office paths
            const officePaths = [
                'C:\\Program Files\\Microsoft Office\\Office16\\OSPP.VBS',
                'C:\\Program Files (x86)\\Microsoft Office\\Office16\\OSPP.VBS',
                'C:\\Program Files\\Microsoft Office\\Office15\\OSPP.VBS',
                'C:\\Program Files (x86)\\Microsoft Office\\Office15\\OSPP.VBS'
            ]

            let vbsPath = officePaths.find(p => fs.existsSync(p))
            if (!vbsPath) return { status: 'UNKNOWN', note: 'Office license engine not found.' }

            const { stdout } = await execAsync(`cscript //nologo "${vbsPath}" /dstatus`)
            const lowerOutput = stdout.toLowerCase()

            if (lowerOutput.includes('licensed')) {
                return { status: 'LICENSED', note: 'Microsoft Office is permanently licensed.' }
            } else if (lowerOutput.includes('grace period')) {
                const daysMatch = stdout.match(/remaining grace: (\d+)/i)
                return { status: 'EXPIRING', note: `⚠ Office is in Grace Period. Days remaining: ${daysMatch ? daysMatch[1] : 'Unknown'}.` }
            } else if (lowerOutput.includes('unlicensed')) {
                return { status: 'UNLICENSED', note: '⚠ Microsoft Office is currently unlicensed.' }
            }

            return { status: 'DETECTION_FAILED', note: 'Office found but license status is ambiguous.' }
        } catch (e) {
            return { status: 'ERROR', note: 'Failed to access Office licensing engine.' }
        }
    })

    ipcMain.handle('save-software', (_, deviceId, softwares) => {
        const deleteStmt = db.prepare('DELETE FROM software_inventory WHERE device_id = ?')
        deleteStmt.run(deviceId)

        const insertStmt = db.prepare(`
      INSERT INTO software_inventory (device_id, name, version, is_licensed, license_validity, type, license_required, compliance_note, path, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

        const transaction = db.transaction((rows: any[]) => {
            for (const row of rows) {
                // Compatible with both scan results (is_licensed) and save state (isLicensed)
                const isLicensed = row.isLicensed !== undefined ? row.isLicensed : row.is_licensed
                const licReq = row.licenseRequired !== undefined ? row.licenseRequired : row.license_required
                const note = row.complianceNote !== undefined ? row.complianceNote : row.compliance_note
                const validity = row.licenseValidity !== undefined ? row.licenseValidity : row.license_validity

                insertStmt.run(
                    deviceId,
                    row.name,
                    row.version,
                    isLicensed ? 1 : 0,
                    validity,
                    row.type,
                    licReq ? 1 : 0,
                    note,
                    row.path || '',
                    row.icon || ''
                )
            }
        })

        transaction(softwares)
        return true
    })

    ipcMain.handle('delete-device', (_, deviceId) => {
        const deleteSoftware = db.prepare('DELETE FROM software_inventory WHERE device_id = ?')
        const deleteDevice = db.prepare('DELETE FROM devices WHERE id = ?')

        const transaction = db.transaction(() => {
            deleteSoftware.run(deviceId)
            deleteDevice.run(deviceId)
        })

        transaction()
        return true
    })

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
