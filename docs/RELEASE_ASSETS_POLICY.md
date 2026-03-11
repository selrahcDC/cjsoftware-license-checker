# Release Assets Policy

**Confidential/Internal Use Only**

This policy outlines the official set of assets that should be included in every public release of `CJSoftware License Checker`.

## 📦 Required Assets
Every official release version (e.g., `v1.0.0`) must contain only these four primary files:

1.  **CJSoftware License Checker-arm64.dmg** (Mac Apple Silicon Installer)
2.  **CJSoftware License Checker-x64.dmg** (Mac Intel Installer)
3.  **CJSoftware License Checker-Setup.exe** (Windows Installer)
4.  **CJSoftware License Checker-Portable.exe** (Windows Portable)
5.  **latest.yml** & **latest-mac.yml** (Required for Auto-Updater metadata)

*Note: GitHub automatically generates `.zip` and `.tar.gz` source code bundles for every release.*

---

## 🛑 Prohibited Assets (Do Not Upload)
To keep our public release page clean and clutter-free, the following files are **excluded** automatically by our GitHub Actions build script:
- `*.blockmap` files (unless differential updates are required)
- `*.zip` files (for MacOS)
- Internal build logs or experimental binaries

---

## 🛠️ How to Trigger a Clean Release
To release a new version while adhering to this policy:
1.  **Update package.json**: Change the `"version"` field (e.g., `1.0.1`).
2.  **Commit and Push**: `git add`, `git commit`, `git push origin main`.
3.  **Create Version Tag**: `git tag v1.0.1`.
4.  **Signal Deployment**: `git push origin v1.0.1`.

The automated CI/CD pipeline (`.github/workflows/release.yml`) is already configured to strictly filter for only `.dmg` and `.exe` files when it creates the official GitHub Release page.
