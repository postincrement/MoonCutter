class PreferencesManager {
    constructor() {
        this.defaultPreferences = {
            units: 'mm',  // 'mm' or 'in'
        };
        this.preferences = { ...this.defaultPreferences };
        this.initialized = false;
        this.preferenceChangeCallbacks = [];
        this.init();
        this.setupListeners();
    }

    setupListeners() {
        // Listen for preference changes from other windows
        window.api.onPreferencesChanged((event, preferences) => {
            this.preferences = { ...this.defaultPreferences, ...preferences };
            this.applyPreferences();
            // Notify all registered callbacks
            this.preferenceChangeCallbacks.forEach(callback => callback(preferences));
        });
    }

    onPreferenceChange(callback) {
        this.preferenceChangeCallbacks.push(callback);
    }

    async init() {
        await this.loadPreferences();
        this.initialized = true;
        this.applyPreferences();
    }

    async loadPreferences() {
        try {
            const response = await window.api.loadPreferences();
            if (response) {
                this.preferences = { ...this.defaultPreferences, ...response };
            } else {
                logMessage('error', 'loadPreferences returned no data');
            }
        } catch (error) {
            logMessage('error', 'preferences loading failed:', error);
        }
    }

    async savePreferences() {
        try {
            const response = await window.api.savePreferences(this.preferences);
            if (!response.success) {
                throw new Error('Failed to save preferences');
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    getPreference(key) {
        if (!this.initialized) {
            logMessage('warn', 'Preferences not yet initialized, using default value for:', key);
            return this.defaultPreferences[key];
        }
        return this.preferences[key];
    }

    setPreference(key, value) {
        this.preferences[key] = value;
        this.applyPreferences();
        this.savePreferences();
    }

    applyPreferences() {
        if (!this.initialized) {
            return;
        }
        // Update UI elements based on preferences
        const unitElements = document.querySelectorAll('.unit-display');
        unitElements.forEach(element => {
            element.textContent = this.preferences.units;
        });

        // Trigger a redraw of the canvas to update scale indicators
        if (typeof window.renderImageToCanvas === 'function') {
            window.renderImageToCanvas();
        }
    }
}

// Create global preferences instance
window.preferencesManager = new PreferencesManager(); 