import { app, shell, BrowserWindow, ipcMain } from 'electron'
import updater from 'electron-updater'
const { autoUpdater } = updater
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// @ts-ignore
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'

const execAsync = promisify(exec)
const isWin = process.platform === 'win32'

// FIX: Disable Hardware Acceleration for maximum compatibility on older Windows machines
if (isWin) {
    app.disableHardwareAcceleration()
}

// FIX: Global Error Handling to prevent silent exits
process.on('uncaughtException', (error) => {
    console.error('CRITICAL ERROR:', error)
    try {
        const { dialog } = require('electron')
        dialog.showErrorBox('System Error', `The application encountered a critical error: ${error.message}\n\nPlease try running as Administrator or contact support.`)
    } catch (e) {
        console.error('Failed to show error box:', e)
    }
})

let db: any
let mainWindow: BrowserWindow | null = null

// Auto-updater configuration
autoUpdater.autoDownload = false
autoUpdater.logger = console
autoUpdater.allowPrerelease = true

const sendUpdateMessage = (type: string, data?: any) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-message', { type, data })
    }
}

autoUpdater.on('checking-for-update', () => sendUpdateMessage('checking'))
autoUpdater.on('update-available', (info) => sendUpdateMessage('available', info))
autoUpdater.on('update-not-available', (info) => sendUpdateMessage('not-available', info))
autoUpdater.on('error', (err) => sendUpdateMessage('error', err.message))
autoUpdater.on('download-progress', (progressObj) => sendUpdateMessage('downloading', progressObj))
autoUpdater.on('update-downloaded', (info) => sendUpdateMessage('downloaded', info))

const loadAlternatives = () => {
    try {
        let altPath = ''
        if (app.isPackaged) {
            altPath = path.join(process.resourcesPath, 'alternatives.json')
        } else {
            // Development path strategies
            const strategies = [
                path.join(app.getAppPath(), 'resources/alternatives.json'),
                path.join(process.cwd(), 'resources/alternatives.json'),
                path.join(__dirname, '../../resources/alternatives.json')
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
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        show: false,
        autoHideMenuBar: true,
        icon: icon,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        if (mainWindow) mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
}

// FIX: Ensure only one instance of the app runs at a time
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    app.whenReady().then(() => {
        try {
            // Initialize Database
            const dbPath = path.join(app.getPath('userData'), 'cj_license_checker.db')
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
        } catch (dbError: any) {
            console.error('DATABASE ERROR:', dbError)
            // Still create window so app doesn't look "dead"
            setTimeout(() => {
                const { dialog } = require('electron')
                dialog.showErrorBox('Database Error', `Failed to initialize the local database: ${dbError.message}\n\nExisting audit logs may not be accessible.`)
            }, 1000)
        }

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
            'autodesk', 'autocad', '3ds max', 'maya', 'revit', 'fusion 360', 'affinity photo', 'affinity designer', 'affinity publisher', 'capture one',
            'corel', 'painter', 'paintshop', 'quarkxpress', 'dxo photolab', 'sketch',
            // Development
            'jetbrains', 'intellij', 'webstorm', 'pycharm', 'phpstorm', 'clion', 'rider', 'datagrip', 'navicat', 'beyond compare', 'sublime text',
            'tower', 'gitkraken', 'postman enterprise', 'vmware fusion', 'vmware workstation',
            // Office & Productivity
            'microsoft office', 'microsoft word', 'microsoft excel', 'microsoft powerpoint', 'microsoft outlook', 'ms office', 'visio', 'ms project',
            'quickbooks', 'camtasia', 'snagit', 'omnifocus', 'omnigraffle', 'fantastical', 'scrivener', 'final cut pro', 'logic pro', 'cleanmymac',
            'nitro pdf', 'foxit pdf editor', 'abbyy finereader', 'dragon naturallyspeaking', 'busycal', 'devonthink',
            // Password Managers (paid)
            '1password',
            // Security & VPN
            'expressvpn', 'nordvpn', 'mcafee', 'norton', 'kaspersky', 'avg premium', 'avast premium', 'sophos home premium', 'eset smart security', 'bitdefender total',
            'malwarebytes premium', 'tunnelbear', 'surfshark',
            // Data & Analysis
            'tableau', 'power bi', 'sas', 'spss', 'arcgis', 'matlab', 'wolfram mathematica'
        ]
        const freeKeywords = [
            // Browsers & Communication
            'google chrome', 'firefox', 'opera', 'vivaldi', 'tor browser', 'arc browser', 'chromium', 'microsoft edge', 'brave',
            'whatsapp', 'telegram', 'signal', 'viber', 'messenger', 'discord', 'slack', 'zoom', 'skype', 'microsoft teams',
            // Development Tools
            'visual studio code', 'vscode', 'vscodium', 'vs community', 'visual studio community', 'atom', 'cursor', 'opencode',
            'anaconda', 'python', 'node.js', 'npm', 'git', 'homebrew', 'iterm', 'warp', 'docker', 'postman', 'insomnia', 'bruno',
            'figma', 'dbeaver', 'db browser', 'dbngin', 'fork', 'sourcetree', 'github desktop', 'putty', 'filezilla', 'wireshark', 'cyberduck',
            'cockpit', 'openmtp', 'herd', 'keka', 'mounty', 'rectangle',
            // Productivity & Cloud
            'google docs', 'google sheets', 'google slides', 'google drive', 'icloud', 'onedrive', 'dropbox', 'box', 'mega', 'nextcloud',
            'notion', 'clickup', 'monday.com', 'asana', 'trello', 'evernote', 'todoist', 'joplin', 'obsidian', 'logseq', 'bear', 'craft',
            'bitwarden', 'keepass', 'lastpass',
            // Office - free/open source variants
            'libreoffice', 'wpsoffice', 'onlyoffice', 'keynote', 'numbers', 'pages',
            // Media & Graphics
            'vlc', 'spotify', 'apple music', 'itunes', 'handbrake', 'iina', 'plex', 'kodi', 'audacity', 'obs studio', 'vnc viewer',
            'inkscape', 'gimp', 'blender', 'krita', 'darktable', 'rawtherapee', 'davinci resolve', 'canva', 'framer',
            // Games & Social
            'steam', 'epic games', 'battle.net', 'origin', 'ubisoft connect', 'gog galaxy', 'roblox', 'minecraft',
            // AI & Cloud
            'claude', 'antigravity', 'ollama', 'openai', 'chatgpt',
            // Utilities (clearly free)
            '7-zip', 'notepad++', 'appcleaner', 'transmission', 'qbittorrent', 'spectacle',
            'malwarebytes free', 'avg free', 'avast free', 'bitdefender free', 'sophos endpoint', 'recuva', 'xampp',
            'quick share', 'epson', 'hp', 'brother', 'canon', 'gameinput', 'health tools', 'update health',
            'free download manager', 'freefilesync'
            // NOTE: anydesk, teamviewer excluded — dual-license (free/paid) → falls through to Third-Party App for manual verification
            // NOTE: 1password excluded — paid subscription → moved to commercialKeywords
        ]

        const categorize = (name: string, obtainedFrom: string = '', appPath: string = '') => {
            if (!name) return { type: 'Unknown', licenseRequired: 0, note: 'Missing application name' }
            const lowerName = name.toLowerCase()
            // Also match against folder name (e.g. "Google Chrome" from path, vs "Chrome" from plist)
            const folderName = path.basename(appPath || '', '.app').toLowerCase()

            const matchesAny = (keywords: string[]) => keywords.some(k => lowerName.includes(k) || folderName.includes(k))

            // Explicit free/open source match
            if (matchesAny(freeKeywords)) return { type: 'Freeware/Open Source', licenseRequired: 0, note: 'Free or Open Source software' }
            // Explicit commercial match
            if (matchesAny(commercialKeywords)) return { type: 'Commercial', licenseRequired: 1, note: 'Paid software - verify active license' }

            // Utility/Helper detection
            const utilityKeywords = ['cli', 'driver', 'runtime', 'daemon', 'agent', 'service', 'plugin', 'helper', 'installer', 'uninstaller', 'updater', 'notifier', 'shim']
            if (utilityKeywords.some(k => lowerName.includes(k) || folderName.includes(k))) {
                return { type: 'Utility/Helper', licenseRequired: 0, note: 'System Utility or Background Service' }
            }

            // Fallback: Treat as a neutral third-party app — do NOT flag as action-required
            // The deep scan (Gatekeeper/codesign) will flag if something is actually wrong
            return { type: 'Third-Party App', licenseRequired: 0, note: 'Third-party application — verify license if required by your institution' }
        }

        const isTrialVersion = (name: string, version: string) => {
            // 'beta' and 'preview' removed — these are release channels, not trial versions
            // (e.g. Chrome Beta, Firefox Preview are fully legitimate)
            const trialKeywords = ['trial', 'evaluation', 'demo', 'expiring']
            const lowerString = (name + ' ' + version).toLowerCase()
            return trialKeywords.some(k => lowerString.includes(k))
        }

        // --- Microsoft Office macOS License Verification ---
        // Detects the VL Serializer crack: the most common method to crack Office on macOS.
        // The crack places a fake Volume License at /Library/Preferences/com.microsoft.office.licensingV2.plist
        // and writes "PerpetualLicenseInfo" into MicrosoftRegistrationDB.
        const checkOfficeLicenseMac = async (): Promise<{ isLicensed: boolean; note: string }> => {
            try {
                const vlPlistPath = '/Library/Preferences/com.microsoft.office.licensingV2.plist'
                const regDbDir = `${process.env.HOME}/Library/Group Containers/UBF8T346G9.Office/MicrosoftRegistrationDB`

                // Check 1: If the VL plist exists at system level, it was placed by VL Serializer crack
                const vlPlistExists = fs.existsSync(vlPlistPath)

                // Check 2: Find the MicrosoftRegistrationDB .reg file (filename contains machine-specific ID)
                let hasPerpetualLicenseInjection = false
                let hasSubscriptionLicense = false
                if (fs.existsSync(regDbDir)) {
                    const regFile = fs.readdirSync(regDbDir).find(f => f.endsWith('.reg'))
                    const regDbPath = regFile ? path.join(regDbDir, regFile) : null
                    if (regDbPath && fs.existsSync(regDbPath)) {
                        try {
                            const regContent = fs.readFileSync(regDbPath)
                            const regText = regContent.toString('binary')
                            // PerpetualLicenseInfo = VL Serializer injected a fake perpetual license
                            if (regText.includes('PerpetualLicenseInfo')) hasPerpetualLicenseInjection = true
                            // For a REAL Microsoft 365 subscription, Office stores the signed-in email
                            // DIRECTLY after 'NextUserLicensingLicensedUserIds' in the binary reg file.
                            // We look for a valid email pattern in a 100-char window after that marker.
                            const markerKey = 'NextUserLicensingLicensedUserIds'
                            const markerIdx = regText.indexOf(markerKey)
                            if (markerIdx !== -1) {
                                // Extract the next 100 characters after the marker
                                const window = regText.substring(markerIdx + markerKey.length, markerIdx + markerKey.length + 100)
                                // A real email (user@domain.tld) must appear in this window
                                const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
                                if (emailPattern.test(window)) {
                                    hasSubscriptionLicense = true
                                }
                            }
                        } catch (e) {}
                    }
                }

                // Logic:
                // - Subscription license (email tied) = Legitimate Microsoft 365
                // - VL plist + PerpetualLicenseInjection (no real subscription) = VL Serializer crack
                if (hasSubscriptionLicense) {
                    return { isLicensed: true, note: 'Microsoft 365 subscription license detected.' }
                }
                if (vlPlistExists && hasPerpetualLicenseInjection) {
                    return { isLicensed: false, note: '⚠ Cracked Office detected: VL Serializer license injection found. This is not a legitimate Microsoft license.' }
                }
                // No clear evidence either way
                return { isLicensed: false, note: 'Microsoft Office — no active subscription or license found. Verify with administrator.' }
            } catch (e) {
                return { isLicensed: false, note: 'Microsoft Office — could not verify license. Manually confirm.' }
            }
        }

        // FIX #5: Pre-compute KMS tool detection ONCE for Windows (not per-app)
        // This avoids running 5x existsSync checks for every single application in the loop
        const kmsCrackToolPaths = [
            'C:\\Program Files\\KMSPico',
            'C:\\Program Files (x86)\\KMSPico',
            'C:\\Windows\\KMSAuto',
            'C:\\Windows\\SECOH-QAD.exe',
            'C:\\ProgramData\\KMSPico'
        ]
        const kmsToolDetected = process.platform === 'win32'
            ? kmsCrackToolPaths.some(p => fs.existsSync(p))
            : false

        const performDeepScan = async (name: string, appFilePath: string) => {
            const results: { status: string; note: string } = { status: 'Normal', note: '' }

            try {
                // Use pre-computed KMS result (computed once before the loop — much faster)
                if (process.platform === 'win32' && kmsToolDetected) {
                    return { status: 'CRACKED', note: '⚠ KMS Activation crack tool found on this system (KMSPico/KMSAuto)' }
                }

                // Adobe amtlib.dll check — only for Adobe apps on macOS
                if (name.toLowerCase().includes('adobe') && appFilePath) {
                    const amtlib = path.join(appFilePath, 'amtlib.dll')
                    if (fs.existsSync(amtlib)) {
                        results.note = 'Audit: Adobe license file present locally — verify activation.'
                    }
                }

            } catch (err) {
                console.error('Deep scan error:', err)
            }
            return results
        }

        if (process.platform === 'darwin') {
            try {
                console.log('[Main] Starting macOS scan — reading /Applications/ directly...')
                
                // FIX #9: Scan both /Applications (system-wide) and ~/Applications (user-level)
                const systemAppsDir = '/Applications'
                const userAppsDir = `${process.env.HOME}/Applications`

                const readApps = (dir: string) =>
                    fs.existsSync(dir)
                        ? fs.readdirSync(dir)
                            .filter(name => name.endsWith('.app'))
                            .map(name => path.join(dir, name))
                        : []

                const appEntries = [
                    ...readApps(systemAppsDir),
                    ...readApps(userAppsDir)
                ]

                console.log(`[Main] Found ${appEntries.length} .app entries in /Applications/ + ~/Applications/`)

                const results = []
                for (const appPath of appEntries) {
                    try {
                        // Read Info.plist to get app name and version
                        const plistPath = path.join(appPath, 'Contents', 'Info.plist')
                        // Use folder name as the display name by default — it's always human-readable
                        // (e.g. "Microsoft Excel" not just "Excel" from CFBundleName)
                        const folderDisplayName = path.basename(appPath, '.app')
                        let appName = folderDisplayName
                        let version = 'Unknown'

                        if (fs.existsSync(plistPath)) {
                            try {
                                const { stdout: plistJson } = await execAsync(`plutil -convert json -o - "${plistPath}"`)
                                const plistData = JSON.parse(plistJson)
                                // Only use CFBundleName if it's a longer/more descriptive name than the folder
                                const bundleName = plistData.CFBundleDisplayName || plistData.CFBundleName || ''
                                if (bundleName.length > folderDisplayName.length) {
                                    appName = bundleName
                                }
                                version = plistData.CFBundleShortVersionString || plistData.CFBundleVersion || 'Unknown'
                            } catch (e) {
                                // Fallback to folder name (already set)
                            }
                        }

                        const category = categorize(appName, '', appPath)
                        // Commercial software cannot be auto-verified — always flag for manual review
                        let complianceStatus = category.type !== 'Commercial'
                        let complianceNote = category.note
                        let iconDataUrl = ''

                        // Try to get icon
                        try {
                            const icon = await app.getFileIcon(appPath, { size: 'normal' })
                            iconDataUrl = icon.toDataURL()
                        } catch (e) {}

                        // PRIMARY CHECK: Gatekeeper assessment (spctl)
                        // Any app that Gatekeeper rejects is unsigned or tampered — definitive flag
                        // FIX #1: removed unused 'spctlOut' variable (we only care about exit code)
                        // FIX #4: track Gatekeeper failure separately so Office check can't overwrite it
                        let gatekeeperFailed = false
                        try {
                            await execAsync(`spctl --assess --type execute "${appPath}" 2>&1`)
                            // exit 0 = approved by Gatekeeper
                        } catch (spctlErr: any) {
                            // Non-zero exit = Gatekeeper issue. Read both stdout and message.
                            const msg = ((spctlErr.stdout || '') + (spctlErr.message || '')).toLowerCase()
                            if (msg.includes('rejected') || msg.includes('not signed') || msg.includes('no usable signature')) {
                                complianceStatus = false
                                complianceNote = '⚠ Not approved by macOS Gatekeeper — unsigned or tampered'
                                gatekeeperFailed = true
                            }
                            // 'assessment not found' = app not yet assessed, treat as OK
                        }

                        // SECONDARY CHECK: deep scan (Adobe amtlib etc.)
                        if (complianceStatus) {
                            const deepResult = await performDeepScan(appName, appPath)
                            if (deepResult.status !== 'Normal') {
                                complianceStatus = false
                                complianceNote = deepResult.note
                            } else if (deepResult.note) {
                                complianceNote = deepResult.note
                            }
                        }

                        // SPECIALIZED CHECK: Microsoft Office (macOS VL Serializer crack detection)
                        // FIX #4: only runs if Gatekeeper did NOT already flag this app;
                        // Gatekeeper failure is more severe and must not be overwritten
                        const officeApps = ['microsoft word', 'microsoft excel', 'microsoft powerpoint', 'microsoft outlook', 'microsoft onenote']
                        const isOfficeApp = officeApps.some(o => appName.toLowerCase().includes(o) || appPath.toLowerCase().includes(o))
                        if (isOfficeApp && !gatekeeperFailed) {
                            const officeCheck = await checkOfficeLicenseMac()
                            complianceStatus = officeCheck.isLicensed
                            complianceNote = officeCheck.note
                        }

                        const isTrial = isTrialVersion(appName, version)
                        const finalComplianceNote = isTrial ? `⚠ Trial/Evaluation version detected.` : complianceNote
                        const complianceStatusFinal = complianceStatus && !isTrial
                        const alternative = (!complianceStatusFinal) ? getAlternative(appName, alternativesMap) : null

                        let licenseValidity = 'Permanent'
                        if (isTrial) licenseValidity = 'Trial Version'
                        else if (!complianceStatus) licenseValidity = 'Action Required'
                        else if (category.type === 'Commercial') licenseValidity = 'Verify License'

                        results.push({
                            name: appName,
                            version,
                            type: category.type,
                            license_required: category.licenseRequired,
                            is_licensed: complianceStatusFinal,
                            compliance_note: finalComplianceNote,
                            license_validity: licenseValidity,
                            alternative,
                            icon: iconDataUrl,
                            path: appPath
                        })
                    } catch (appErr) {
                        console.error(`[Main] Failed to process ${appPath}:`, appErr)
                    }
                }

                console.log(`[Main] macOS scan complete. Returning ${results.length} items.`)
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

                // Fetch Publisher field too for better categorization
                const cmd = `powershell "Get-ItemProperty ${paths.join(', ')} -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 -and $_.UninstallString -ne $null -and $_.DisplayName -notmatch '^Update for' -and $_.DisplayName -notmatch 'Redistributable' } | Select-Object DisplayName, DisplayVersion, Publisher | ConvertTo-Json"`
                const { stdout, stderr } = await execAsync(cmd)
                
                if (stderr) console.warn('[Main] Windows Scan Stderr:', stderr)
                if (!stdout || stdout.trim() === '') {
                    console.log('[Main] No applications found via PowerShell Registry check.')
                    return []
                }

                let data;
                try {
                    data = JSON.parse(stdout)
                } catch (pe) {
                    console.error('[Main] JSON Parse Failure. Raw PS Output:', stdout.substring(0, 500))
                    return []
                }

                const rawApps = Array.isArray(data) ? data : (data ? [data] : [])
                console.log(`[Main] Processed ${rawApps.length} programs from Registry.`)

                const appMap = new Map()
                rawApps.forEach((app: any) => {
                    const name = app.DisplayName?.trim()
                    if (name) appMap.set(name, app)
                })

                const uniqueApps = Array.from(appMap.values())
                console.log(`Scan finished. Found ${uniqueApps.length} programs in Registry. Processing results...`)

                const finalResults = await Promise.all(uniqueApps.map(async (app: any) => {
                    const appName = app.DisplayName || 'Unknown Program'
                    const category = categorize(appName, '', '')
                    // Commercial apps always need manual license verification
                    let complianceStatus = category.type !== 'Commercial'
                    let complianceNote = category.note

                    // Deep scan: KMS crack tool detection
                    const deepResult = await performDeepScan(appName, '')
                    if (deepResult.status !== 'Normal') {
                        complianceStatus = false
                        complianceNote = deepResult.note
                    }

                    const isTrial = isTrialVersion(appName, app.DisplayVersion || '')
                    const finalComplianceNote = isTrial ? `⚠ Trial/Evaluation program detected.` : complianceNote
                    const complianceStatusFinal = complianceStatus && !isTrial
                    const alternative = (!complianceStatusFinal) ? getAlternative(appName, alternativesMap) : null

                    let licenseValidity = 'Licensed/OK'
                    if (isTrial) licenseValidity = 'Trial/Evaluation'
                    else if (!complianceStatus) licenseValidity = 'Action Required'
                    else if (category.type === 'Commercial') licenseValidity = 'Verify License'

                    return {
                        name: appName,
                        version: app.DisplayVersion || 'Unknown',
                        type: category.type,
                        license_required: category.licenseRequired,
                        is_licensed: complianceStatusFinal,
                        compliance_note: finalComplianceNote,
                        license_validity: licenseValidity,
                        alternative,
                        icon: '',
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
                    const slmgrLower = slmgr.toLowerCase()
                    if (slmgrLower.includes('kms') || slmgrLower.includes('volume')) {
                        // KMS activation found — check if it's from a crack tool or a legitimate enterprise KMS
                        const crackPaths = [
                            'C:\\Program Files\\KMSPico',
                            'C:\\Program Files (x86)\\KMSPico',
                            'C:\\Windows\\KMSAuto',
                            'C:\\Windows\\v3.su',
                            'C:\\Windows\\SECOH-QAD.exe',
                            'C:\\ProgramData\\KMSPico'
                        ]
                        if (crackPaths.some(p => fs.existsSync(p))) {
                            result.status = 'CRACKED'
                            result.note = '⚠ OS Activation is handled by an unauthorized KMS Tool (Crack detected).'
                        } else {
                            result.note = 'Information: Windows uses Volume/KMS Activation (Standard for Enterprises/Schools).'
                        }
                    } else if (slmgrLower.includes('unlicensed') || slmgrLower.includes('notification')) {
                        result.status = 'UNLICENSED'
                        result.note = '⚠ Windows is not activated or running in notification mode.'
                    }
                } catch (e) {
                    console.error('slmgr check failed', e)
                }

                // 3. Check license expiration via slmgr /xpr
                try {
                    const { stdout: xpr } = await execAsync('cscript //nologo %systemroot%\\system32\\slmgr.vbs /xpr')
                    if (xpr.includes('will expire')) {
                        result.status = 'EXPIRING'
                        const dateMatch = xpr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
                        result.note = `⚠ Windows license is temporary and will expire: ${dateMatch ? dateMatch[0] : 'Check slmgr output'}.`
                    } else if (xpr.toLowerCase().includes('permanently activated')) {
                        result.note = 'Information: Windows is permanently activated.'
                    }
                } catch (e) { }

                // 4. Check for unauthorized KMS services running in background
                try {
                    const { stdout: services } = await execAsync('powershell "Get-Service | Where-Object { $_.Name -match \'KMS\' -or $_.DisplayName -match \'KMS\' } | Select-Object Name, DisplayName | ConvertTo-Json"')
                    if (services && services.trim() !== '' && services.trim() !== 'null') {
                        try {
                            const parsedServices = JSON.parse(services)
                            const serviceList = Array.isArray(parsedServices) ? parsedServices : [parsedServices]
                            if (serviceList.length > 0 && serviceList.some((s: any) => s.Name)) {
                                result.status = 'CRACKED'
                                result.note = `⚠ Unauthorized KMS Activation Service found: "${serviceList[0]?.Name}" (Crack tool running in background).`
                            }
                        } catch (pe) { /* JSON parse failed — no services found */ }
                    }
                } catch (e) { }

                // 5. Microsoft Office License Check (Windows) via ospp.vbs
                // ospp.vbs is Microsoft's official Office licensing diagnostic tool
                const officePaths = [
                    'C:\\Program Files\\Microsoft Office\\Office16\\ospp.vbs',
                    'C:\\Program Files (x86)\\Microsoft Office\\Office16\\ospp.vbs',
                    'C:\\Program Files\\Microsoft Office\\root\\Office16\\ospp.vbs'
                ]
                const osppPath = officePaths.find(p => fs.existsSync(p))
                if (osppPath) {
                    try {
                        const { stdout: osppOut } = await execAsync(`cscript //nologo "${osppPath}" /dstatus`)
                        const osppLower = osppOut.toLowerCase()
                        // If Office shows KMS activation AND crack tools also exist → cracked
                        const officeKmsActive = osppLower.includes('volume_kmsclient') || osppLower.includes('kms')
                        const officeCrackPresent = [
                            'C:\\Program Files\\KMSPico',
                            'C:\\Program Files (x86)\\KMSPico',
                            'C:\\Windows\\KMSAuto',
                            'C:\\Windows\\SECOH-QAD.exe'
                        ].some(p => fs.existsSync(p))
                        if (officeKmsActive && officeCrackPresent) {
                            result.note += ' | ⚠ Microsoft Office is KMS-activated via an unauthorized crack tool.'
                        } else if (osppLower.includes('licensed')) {
                            result.note += ' | ✓ Microsoft Office appears legitimately licensed.'
                        } else if (osppLower.includes('unlicensed') || osppLower.includes('notification mode')) {
                            result.note += ' | ⚠ Microsoft Office is NOT activated.'
                        }
                    } catch (e) { /* ospp.vbs not accessible */ }
                }

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

    // Auto-update IPC
    ipcMain.handle('check-for-updates', () => {
        autoUpdater.checkForUpdatesAndNotify()
    })

    ipcMain.handle('start-download', () => {
        autoUpdater.downloadUpdate()
    })

    ipcMain.handle('quit-and-install', () => {
        autoUpdater.quitAndInstall()
    })

    createWindow()

    // Check for updates on startup
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify()
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    })
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
