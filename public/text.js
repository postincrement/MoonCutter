// Text handling for MoonCutter

const FONT_SIZE_SCALE = 5;

// Global variables for text settings
let g_textSettings = {
    m_text: '',
    m_font: 'Arial',
    m_sampleFontSize: 16,
    m_fontSize: 16 * FONT_SIZE_SCALE,
    m_bold: false,
    m_italic: false,
    m_underline: false,
    m_justify: 'left',  // 'left', 'center', or 'right'
    m_invert: false,
    m_rotateAngle: 0,
    m_imageOffsetX: 0,
    m_imageOffsetY: 0,
    m_imageScale: 1,
    m_keyhole: false
};

// Function to update sample text display
function updateSampleText() {
    const sampleText = document.getElementById('sampleText');
    
    sampleText.style.fontFamily     = g_textSettings.m_font;
    sampleText.style.fontSize       = `${g_textSettings.m_sampleFontSize}px`;
    sampleText.style.fontWeight     = g_textSettings.m_bold ? 'bold' : 'normal';
    sampleText.style.fontStyle      = g_textSettings.m_italic ? 'italic' : 'normal';
    sampleText.style.textDecoration = g_textSettings.m_underline ? 'underline' : 'none';
    sampleText.style.textAlign      = g_textSettings.m_justify;
}

// rotate controls
g_rotateTextLeftButton.addEventListener('click', () => {
  g_textSettings.m_rotateAngle -= 90;
  if (g_textSettings.m_rotateAngle < 0) {
    g_textSettings.m_rotateAngle += 360;
  }
  if (g_textImageBuffer) {
    g_textImageBuffer.adjustOffsetAfterRotation(g_textSettings, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
    renderTextToBuffer();
  }
});
  
g_rotateTextRightButton.addEventListener('click', () => {
  g_textSettings.m_rotateAngle += 90;
  if (g_textSettings.m_rotateAngle >= 360) {
    g_textSettings.m_rotateAngle -= 360;
  }
  if (g_textImageBuffer) {
    g_textImageBuffer.adjustOffsetAfterRotation(g_textSettings, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
    renderImageToScreen();
  }
});
  
// Text input event
g_textInput.addEventListener('input', (e) => {
    g_textSettings.m_text = e.target.value;
    // Hide drop zone if text is entered
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.style.display = g_textSettings.m_text.trim() ? 'none' : 'flex';
    }
    renderTextToBuffer();
});

// Font selection event
g_fontSelect.addEventListener('change', (e) => {
    g_textSettings.m_font = e.target.value;
    updateSampleText();
    renderTextToBuffer();
});

// Font size slider event
g_fontSizeSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    g_textSettings.m_fontSize = value * FONT_SIZE_SCALE;
    renderTextToBuffer();
});

// Font size input event
g_fontSizeInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    // Clamp value between min and max
    value = Math.max(12, Math.min(144, value));
    g_textSettings.m_fontSize = value;
    renderTextToBuffer();
});

// Style button events
g_boldButton.addEventListener('click', () => {
    g_boldButton.classList.toggle('active');
    g_textSettings.m_bold = g_boldButton.classList.contains('active');
    updateSampleText();
    renderTextToBuffer();
});

g_italicButton.addEventListener('click', () => {
    g_italicButton.classList.toggle('active');
    g_textSettings.m_italic = g_italicButton.classList.contains('active');
    updateSampleText();
    renderTextToBuffer();
});

g_underlineButton.addEventListener('click', () => {
    g_underlineButton.classList.toggle('active');
    g_textSettings.m_underline = g_underlineButton.classList.contains('active');
    updateSampleText();
    renderTextToBuffer();
});

// Justification button events
g_justifyLeftButton.addEventListener('click', () => {
    g_justifyLeftButton.classList.add('active');
    g_justifyCenterButton.classList.remove('active');
    g_justifyRightButton.classList.remove('active');
    g_textSettings.m_justify = 'left';
    renderTextToBuffer();
});

g_justifyCenterButton.addEventListener('click', () => {
    g_justifyLeftButton.classList.remove('active');
    g_justifyCenterButton.classList.add('active');
    g_justifyRightButton.classList.remove('active');
    g_textSettings.m_justify = 'center';
    renderTextToBuffer();
});

g_justifyRightButton.addEventListener('click', () => {
    g_justifyLeftButton.classList.remove('active');
    g_justifyCenterButton.classList.remove('active');
    g_justifyRightButton.classList.add('active');
    g_textSettings.m_justify = 'right';
    renderTextToBuffer();
});
  

// Invert text button
g_invertTextButton.addEventListener('click', () => {
    g_invertTextButton.classList.toggle('active');
    logMessage('debug', `invert: ${g_invertTextButton.classList.contains('active')}`);
    g_textSettings.m_invert = g_invertTextButton.classList.contains('active');
    updateSampleText();
    renderTextToBuffer();
});

// Keyhole text button
g_keyholeTextButton.addEventListener('click', () => {
    g_keyholeTextButton.classList.toggle('active');
    logMessage('debug', `keyhole: ${g_keyholeTextButton.classList.contains('active')}`);
    g_textSettings.m_keyhole = g_keyholeTextButton.classList.contains('active');
    updateSampleText();
    renderTextToBuffer();
});


// Initialize text controls
document.addEventListener('DOMContentLoaded', () => {


    // Initial sample text update
    updateSampleText();
});

// Render text to the text image buffer
function renderTextToBuffer() 
{
    if (!g_textSettings.m_text.trim()) {
        // If text is empty, clear the text buffer
        g_textImageBuffer = null;
        renderImageToScreen();
        return;
    }

    // Store current center position if text buffer exists
    let centerX = 0;
    let centerY = 0;
    if (g_textImageBuffer) {
        centerX = g_textSettings.m_imageOffsetX + (g_textImageBuffer.m_width / 2);
        centerY = g_textSettings.m_imageOffsetY + (g_textImageBuffer.m_height / 2);
    }

    // Create a temporary canvas to render the text
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    // Set up the font style
    let fontStyle = '';
    if (g_textSettings.m_bold) fontStyle += 'bold ';
    if (g_textSettings.m_italic) fontStyle += 'italic ';
    fontStyle += `${g_textSettings.m_fontSize}px ${g_textSettings.m_font}`;
    ctx.font = fontStyle;

    // Measure text to determine canvas size
    const lines = g_textSettings.m_text.split('\n');
    let maxWidth = 0;
    let totalHeight = 0;
    const lineHeight = g_textSettings.m_fontSize * 1.2; // 1.2 is a common line height factor

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

    logMessage('debug', `text canvas size: ${width}x${height}`);

    // clear rect to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Set up text rendering
    //ctx.fillStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.font = fontStyle;
    ctx.textBaseline = 'top';

    // Draw text with justification
    let y = padding;
    for (const line of lines) {
        let x = padding;
        const metrics = ctx.measureText(line);
        
        // Apply justification
        switch (g_textSettings.m_justify) {
            case 'center':
                x = (width - metrics.width) / 2;
                break;
            case 'right':
                x = width - metrics.width - padding;
                break;
            default: // 'left'
                x = padding;
        }

        ctx.fillText(line, x, y);
        
        // Draw underline if enabled
        if (g_textSettings.m_underline) {
            const baseline = y + g_textSettings.m_fontSize;
            ctx.beginPath();
            ctx.moveTo(x, baseline);
            ctx.lineTo(x + metrics.width, baseline);
            ctx.stroke();
        }
        
        y += lineHeight;
    }

    // Create or update the text image buffer
    if (!g_textImageBuffer || g_textImageBuffer.m_width !== width || g_textImageBuffer.m_height !== height) {
        g_textImageBuffer = new ImageBuffer(width, height, true);
        
        // Center text on screen for new text
        if (!centerX && !centerY) {
            centerX = g_engraveBuffer.m_width / 2;
            centerY = g_engraveBuffer.m_height / 2;
        }
    }

    // Get the image data from the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Copy the image data to the text buffer
    g_textImageBuffer.m_data.set(imageData.data);

    // Adjust position to maintain center point
    if (centerX !== 0 || centerY !== 0) {
        g_textImageBuffer.m_imageOffsetX = centerX - (width / 2);
        g_textImageBuffer.m_imageOffsetY = centerY - (height / 2);
    }

    // Render the updated image to the canvas
    renderImageToScreen();
}
