# CJSoftware License Checker - Git & Release Policy

## Overview
This document outlines what was configured for the initial Git setup, outlines our Git commit policy, and ensures that only secure, public-facing project files ever make it to the centralized repository.

---

## 🚀 1. What We Did Setup
We migrated the local `cjsoftware-license-checker` directly to GitHub and fully automated the application build process for Mac and Windows. 

Here is what was accomplished:
- **Repository Setup**: Initialized Git, linked to the `selrahcDC/cjsoftware-license-checker` repository.
- **MIT License**: Added an open-source MIT license to protect your intellectual property while allowing open usage.
- **`.gitignore` Hardening**: Configured a rigorous `.gitignore` file to prevent heavy node modules, built executables, and sensitive environment variables from being uploaded.
- **GitHub Actions (CI/CD)**: Created a `.github/workflows/release.yml` file. This tells GitHub servers to look for Version Tags (`v1.0.0`, `v1.1.0`), and automatically build and distribute the app into a `.zip` for Mac and an `.exe` for Windows.

---

## 🛡️ 2. Security & Push Policy

**Rule of Thumb:** We only push *source code*, *documentation*, and *public assets*. We **NEVER** push active configurations, secrets, or compiled binaries. 

### What is ALLOWED to be pushed:
- **Source Code**: `src/`, `package.json`, TypeScript config files.
- **Documentation**: `README.md`, `LICENSE`, `docs/`.
- **Public Assets**: Icons in `resources/` (e.g., `icon.icns`, `icon.ico`).
- **CI/CD Configuration**: `.github/workflows/`.

### What is STRICTLY FORBIDDEN to push (Handled by `.gitignore`):
- **Secrets & Keys**: `.env`, `.pem`, `.key`, `credentials.json`, passwords, or API tokens. 
- **Build Artifacts**: `dist/`, `out/`, `build/`, `release/`. These files are massive and redundant because GitHub Actions builds them automatically in the cloud.
- **Dependencies**: `node_modules/`. (They are generated automatically by running `npm install`).
- **Local IDE Settings**: `.vscode/`, `.idea/`, `.DS_Store`. These clutter the repository for others.

*If you accidentally commit a sensitive file, do not just push a fix deleting it. Bring it up immediately so it can be purged from the Git history.*

---

## 🛠️ 3. Workflow for Updating the App

When you work on the app and are ready to share an update, follow this strict 3-step lifecycle:

### Step 1: Commit Your Work
When you have made stable changes to the source code:
```bash
# Add all valid files (ignores will be filtered out automatically by .gitignore)
git add .

# Write a clear, descriptive message explaining what changed
git commit -m "feat: added new license scanning capability"
```

### Step 2: Push Your Code
Send your source code safely to the main origin:
```bash
git push origin main
```
*Note: This strictly updates the source code on GitHub. It does NOT generate new executables for users to download.*

### Step 3: Trigger a Release Server Build
To actually give your users a new macOS `.zip` and Windows `.exe` download, you must increment the version by "tagging" the codebase.

```bash
# Tag the specific version (e.g., jump from v1.0.0 to v1.0.1)
git tag v1.0.1

# Tell GitHub to trigger the release workflow on their cloud servers
git push origin v1.0.1
```
Once pushed, click the **"Actions"** tab on your GitHub repository to watch it build!
