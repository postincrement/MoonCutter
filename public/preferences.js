class PreferencesManager {
    constructor() {
        this.defaultPreferences = {
            units: 'mm',  // 'mm' or 'in'
        };
        this.preferences = { ...this.defaultPreferences };
        this.loadPreferences();
    }

    async loadPreferences() {
        logMessage('info', 'Loading preferences');
        try {
            const response = await window.api.loadPreferences();
            if (response.success) {
                this.preferences = { ...this.defaultPreferences, ...response.preferences };
                logMessage('info', 'renderer Preferences loaded:', this.preferences);
            }
        } catch (error) {
            console.log('No preferences file found, using defaults');
        }
        logMessage('info', 'renderer Preferences loaded:', this.preferences);
        this.applyPreferences();
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
        return this.preferences[key];
    }

    setPreference(key, value) {
        this.preferences[key] = value;
        this.applyPreferences();
        this.savePreferences();
    }

    applyPreferences() {
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