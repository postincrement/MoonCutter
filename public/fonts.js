// Font loading and selection functionality
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Font loading script started');
    const fontSelect = document.getElementById('fontSelect');
    
    if (!fontSelect) {
        console.error('Font select element not found');
        return;
    }
    
    try {
        console.log('Requesting system fonts...');
        // Get system fonts from main process
        const fonts = await window.api.getSystemFonts();
        console.log('Received fonts:', fonts.length);
        
        // Clear loading message
        fontSelect.innerHTML = '';
        
        // Add fonts to select element
        fonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font;
            option.style.fontFamily = font; // Display font in its actual typeface
            fontSelect.appendChild(option);
        });
        
        // Set Arial as default font if available, otherwise use first font
        const arialIndex = fonts.findIndex(font => font.toLowerCase() === 'arial');
        if (arialIndex !== -1) {
            fontSelect.value = fonts[arialIndex];
            console.log('Default font set to Arial');
        } else if (fonts.length > 0) {
            fontSelect.value = fonts[0];
            console.log('Arial not found, default font set to:', fonts[0]);
        } else {
            console.warn('No fonts available');
        }
    } catch (error) {
        console.error('Error loading fonts:', error);
        fontSelect.innerHTML = '<option value="">Error loading fonts</option>';
    }
});

// Font handling for MoonCutter

// Function to load fonts
async function loadFonts() {
    console.log('Requesting system fonts...');
    
    try {
        // Check if the API is available
        if (window.api && typeof window.api.getFonts === 'function') {
            const fonts = await window.api.getFonts();
            const fontSelect = document.getElementById('fontSelect');
            
            // Clear loading message
            fontSelect.innerHTML = '';
            
            // Add fonts to select
            fonts.forEach(font => {
                const option = document.createElement('option');
                option.value = font;
                option.textContent = font;
                option.style.fontFamily = font;
                fontSelect.appendChild(option);
            });
            
            console.log(`Loaded ${fonts.length} fonts`);
        } else {
            console.log('API not available, using fallback fonts');
            // Add some common fallback fonts
            const fallbackFonts = [
                'Arial',
                'Helvetica',
                'Times New Roman',
                'Courier New',
                'Georgia',
                'Verdana'
            ];
            
            const fontSelect = document.getElementById('fontSelect');
            fontSelect.innerHTML = '';
            
            fallbackFonts.forEach(font => {
                const option = document.createElement('option');
                option.value = font;
                option.textContent = font;
                option.style.fontFamily = font;
                fontSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading fonts:', error);
    }
}

// Load fonts when the document is ready
document.addEventListener('DOMContentLoaded', loadFonts); 