// Text handling for MoonCutter

// Global variables for text settings
let g_textSettings = {
    text: '',
    font: 'Arial',
    fontSize: 16,
    bold: false,
    italic: false,
    underline: false
};

// Initialize text controls
document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('textInput');
    const fontSelect = document.getElementById('fontSelect');
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeInput = document.getElementById('fontSizeInput');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const boldButton = document.getElementById('boldButton');
    const italicButton = document.getElementById('italicButton');
    const underlineButton = document.getElementById('underlineButton');

    // Text input event
    textInput.addEventListener('input', (e) => {
        g_textSettings.text = e.target.value;
        renderTextToBuffer();
    });

    // Font selection event
    fontSelect.addEventListener('change', (e) => {
        g_textSettings.font = e.target.value;
        renderTextToBuffer();
    });

    // Font size slider event
    fontSizeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        fontSizeInput.value = value;
        fontSizeValue.textContent = value;
        g_textSettings.fontSize = value * 10;
        renderTextToBuffer();
    });

    // Font size input event
    fontSizeInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // Clamp value between min and max
        value = Math.max(12, Math.min(32, value));
        fontSizeSlider.value = value;
        fontSizeValue.textContent = value;
        g_textSettings.fontSize = value * 10;
        renderTextToBuffer();
    });

    // Style button events
    boldButton.addEventListener('click', () => {
        g_textSettings.bold = !g_textSettings.bold;
        boldButton.classList.toggle('active');
        renderTextToBuffer();
    });

    italicButton.addEventListener('click', () => {
        g_textSettings.italic = !g_textSettings.italic;
        italicButton.classList.toggle('active');
        renderTextToBuffer();
    });

    underlineButton.addEventListener('click', () => {
        g_textSettings.underline = !g_textSettings.underline;
        underlineButton.classList.toggle('active');
        renderTextToBuffer();
    });
});

// Render text to the text image buffer
function renderTextToBuffer() {
    if (!g_textSettings.text.trim()) {
        // If text is empty, clear the text buffer
        g_textImageBuffer = null;
        renderImageToCanvas();
        return;
    }

    // Create a temporary canvas to render the text
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    // Set up the font style
    let fontStyle = '';
    if (g_textSettings.bold) fontStyle += 'bold ';
    if (g_textSettings.italic) fontStyle += 'italic ';
    fontStyle += `${g_textSettings.fontSize}px ${g_textSettings.font}`;
    ctx.font = fontStyle;

    // Measure text to determine canvas size
    const lines = g_textSettings.text.split('\n');
    let maxWidth = 0;
    let totalHeight = 0;
    const lineHeight = g_textSettings.fontSize * 1.2; // 1.2 is a common line height factor

    // Calculate dimensions needed for the text
    for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
        totalHeight += lineHeight;
    }

    // Add padding
    const padding = 10;
    const width = Math.ceil(maxWidth) + padding * 2;
    const height = Math.ceil(totalHeight) + padding * 2;

    // Resize canvas to fit text
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Set up text rendering
    ctx.fillStyle = 'black';
    ctx.font = fontStyle;
    ctx.textBaseline = 'top';

    // Draw text
    let y = padding;
    for (const line of lines) {
        ctx.fillText(line, padding, y);
        
        // Draw underline if enabled
        if (g_textSettings.underline) {
            const metrics = ctx.measureText(line);
            const baseline = y + g_textSettings.fontSize;
            ctx.beginPath();
            ctx.moveTo(padding, baseline);
            ctx.lineTo(padding + metrics.width, baseline);
            ctx.stroke();
        }
        
        y += lineHeight;
    }

    // Create or update the text image buffer
    if (!g_textImageBuffer || g_textImageBuffer.m_width !== width || g_textImageBuffer.m_height !== height) {
        g_textImageBuffer = new ImageBuffer(width, height);
    }

    // Get the image data from the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Copy the image data to the text buffer
    g_textImageBuffer.m_data.set(imageData.data);

    // Set default scale for the text buffer
    //g_textImageBuffer.setDefaultScale(g_engraveBuffer.m_width, g_engraveBuffer.m_height);

    // Render the updated image to the canvas
    renderImageToCanvas();
}
