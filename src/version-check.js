const { dialog, app } = require('electron');
const https = require('https');
const semver = require('semver');

const VERSION_CHECK_URL = 'https://postincrement.github.io/mooncutter/latest-version.json';

async function checkForUpdates() {
    try {
        const latestVersion = await fetchLatestVersion();
        
        console.log('latestVersion', latestVersion);
        
        if (semver.gt(latestVersion.version, app.getVersion())) {
            const result = await dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `A new version of MoonCutter is available (${latestVersion.version})`,
                detail: `Current version: ${app.getVersion()}\n\nRelease Date: ${latestVersion.pub_date}\n\n${latestVersion.notes}`,
                buttons: ['Download Update', 'Later'],
                defaultId: 0,
                cancelId: 1
            });

            if (result.response === 0) {
                // Open the download URL in the default browser
                require('electron').shell.openExternal(latestVersion.url);
            }
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

function fetchLatestVersion() {
    return new Promise((resolve, reject) => {
        https.get(VERSION_CHECK_URL, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const versionInfo = JSON.parse(data);
                    resolve(versionInfo);
                } catch (error) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

module.exports = {
    checkForUpdates
}; 