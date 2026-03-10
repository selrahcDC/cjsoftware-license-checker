# CJSoftware License Checker — v1.1.0

Cross-platform application designed for industrial-grade software auditing and compliance checking.

![Scan Demonstration](docs/screenshots/scan_demo_v1_1_0.png)

## 🚀 Key Features in v1.1.0
- **Office Security Hardening**: 
  - macOS: Institutional check for VL Serializer crack injections.
  - Windows: Automated `ospp.vbs` activation diagnostics.
- **Deep Scan Engine**: 
  - Multi-path macOS scanning (`/Applications` & `~/Applications`).
  - Optimized Windows Registry & KMS pre-computation.
- **Compliance Intelligence**: 
  - Smart proximity detection (365 Subscriptions vs. Cracks).
  - Nuanced software categorization (Commercial, Freeware, Third-Party).
- **Audit Reporting**:
  - One-click **Save Audit** for historical tracking.
  - **Pro CSV Export**: Excel-ready (UTF-8 BOM) with compliance notes and alternatives.
- **Auto-Updater**: Complete in-app notification and download system for Windows/Mac (redirect).

## 📥 Downloads

*   **[Download for macOS (Apple Silicon)](https://github.com/selrahcDC/cjsoftware-license-checker/releases/latest/download/CJSoftware.License.Checker-1.1.0-arm64.dmg)**
*   **[Download for macOS (Intel)](https://github.com/selrahcDC/cjsoftware-license-checker/releases/latest/download/CJSoftware.License.Checker-1.1.0.dmg)**
*   **[Download for Windows (Installer)](https://github.com/selrahcDC/cjsoftware-license-checker/releases/latest/download/CJSoftware.License.Checker.Setup.1.1.0.exe)**
*   **[Download for Windows (Portable)](https://github.com/selrahcDC/cjsoftware-license-checker/releases/latest/download/CJSoftware.License.Checker-Portable-1.1.0.exe)**

## 🛠️ Tech Stack
- **Electron** (Backend Shell)
- **React + Framer Motion** (Premium UI)
- **Vite** (Build Tooling)
- **SQLite** (Persistence Layer)

## 🏗️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Package the application
npm run build:mac
npm run build:win
```

---
*Authorized for use and utilization by Partido State University.*
