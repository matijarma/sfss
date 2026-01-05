# Plan: Implement Data Encryption Feature

## Objective
Implement client-side data encryption to protect user scripts. Users can set a PIN, which encrypts all script data using Web Crypto API (PBKDF2 + AES-GCM). On app reload, the user must enter the PIN to unlock (decrypt) the data.

## 1. Architecture: `EncryptionManager`
Create a new class `assets/js-mod/EncryptionManager.js` to handle cryptographic operations.
*   **Responsibilities:**
    *   **Key Derivation:** Derive AES-GCM key from user PIN using PBKDF2.
    *   **Encrypt/Decrypt:** Methods to process strings/objects.
    *   **State Management:** Hold the derived key in memory (never persistent).
    *   **Validator:** Manage a "validator" token in LocalStorage to verify PIN correctness without attempting to parse potentially large script data first.

## 2. Storage Layer Refactoring (`StorageManager.js`)
*   Integrate `EncryptionManager`.
*   **Read Path (`getScript`, `getAllScripts`):** If encryption is enabled, data read from IDB/LocalStorage must be passed through `EncryptionManager.decrypt`.
*   **Write Path (`saveScript`):** If encryption is active, data must be passed through `EncryptionManager.encrypt` before storage.
*   **Migration:** Functions to `encryptAllData(pin)` and `decryptAllData(pin)` to handle the transition when the user toggles the feature.

## 3. UI Changes
*   **Universal Welcome/Lock Screen:**
    *   Refactor the existing `#mobile-welcome-modal` in `index.html` to be a generic `#startup-modal`.
    *   Make it visible on desktop if the app is locked OR if it's the first run (replacing the mobile-only welcome logic).
    *   Add a "Security / Unlock" state to this modal with a PIN input field.
*   **Toolbar:**
    *   Add a Lock Icon (`#encryption-status-icon`) to `#toolbar`.
        *   **Icon:** `fa-lock-open` (Enabled & Unlocked) or hidden (Disabled).
        *   **Action:** Clicking it opens the Security Settings.
*   **Settings Modal:**
    *   Add a "Security" section.
    *   Options: "Enable Encryption" (if disabled), "Change PIN", "Disable Encryption" (if enabled).

## 4. Application Flow (`SFSS.js`)
1.  **Boot:**
    *   Check `localStorage.getItem('sfss_encryption_enabled')`.
    *   **If True:** Show `#startup-modal` in "Unlock Mode". Block loading of scripts.
    *   **If False:** Proceed to load scripts as normal. Show `#startup-modal` in "Welcome Mode" only if configured (e.g. first run logic).
2.  **Unlock:**
    *   User enters PIN.
    *   `EncryptionManager` derives key and attempts to decrypt the validator.
    *   **Success:** Store key in memory, hide modal, load active script.
    *   **Fail:** Show error "Incorrect PIN".
3.  **Enabling Encryption:**
    *   User enters PIN.
    *   `EncryptionManager` generates salt/validator.
    *   Iterate all scripts in IDB and LocalStorage -> Encrypt -> Save back.
    *   Set `sfss_encryption_enabled = true`.
4.  **Disabling Encryption:**
    *   User confirms with PIN.
    *   Iterate all scripts -> Decrypt -> Save back as plain text.
    *   Set `sfss_encryption_enabled = false`.
    *   Clear keys from memory.

## 5. Implementation Steps
1.  **Create `EncryptionManager.js`**: Implement Web Crypto logic.
2.  **Modify `index.html`**:
    *   Update `mobile-welcome-modal` to `startup-modal` and add PIN UI structure.
    *   Add Lock Icon to toolbar.
    *   Add Security section to Settings modal.
3.  **Update `StorageManager.js`**: Add hooks for encryption.
4.  **Update `SFSS.js`**:
    *   Initialize `EncryptionManager`.
    *   Change boot sequence to check for lock status.
    *   Bind UI events for locking/unlocking.
5.  **Styles**: Update `base.css` / `components.css` for the new modal states and lock icon.

## Todo List
- [ ] Create `assets/js-mod/EncryptionManager.js`.
- [ ] Update `assets/js-mod/StorageManager.js` to use `EncryptionManager`.
- [ ] Modify `index.html` (Modal, Toolbar, Settings).
- [ ] Update `assets/css/components.css` for new UI elements.
- [ ] Update `assets/js-mod/SFSS.js` logic for boot and locking.
- [ ] Update `assets/js-mod/SettingsManager.js` to handle security settings.
