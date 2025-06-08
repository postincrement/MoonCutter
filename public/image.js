// image buffer loaded from a file 
g_imageBuffer = null;

// text image buffer created from text
g_textImageBuffer = null;

// image at engraver resolution to be engraved
g_engraveBuffer = null;

// bounding box of the image to be engraved
g_boundingBox  = null;

// create a default image and remove any text. Used on start
function setDefaultImage()
{
  logMessage('info', `setDefaultImage()`);

  g_textImageBuffer = null;

  if (g_engraveBuffer) {
    logMessage('info', `image buffer size is ${g_engraveBuffer.m_width}x${g_engraveBuffer.m_height}`);
    g_imageBuffer = new ImageBuffer(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  else {
    g_imageBuffer = new ImageBuffer(512, 512);
    logMessage('error', 'engrave buffer not initialized using default size is 512x512');
  }

  g_imageBuffer.m_default = true;

  logMessage('info', `default image size is ${g_imageBuffer.m_width}x${g_imageBuffer.m_height}`);

  const scale = Math.floor((g_imageBuffer.m_height + g_imageBuffer.m_width) / 256);
  logMessage('info', `scale: ${scale}`);

  // Create a grayscale gradient pattern directly in the buffer
  for (let y = 0; y < g_imageBuffer.m_height; y++) {
    for (let x = 0; x < g_imageBuffer.m_width; x++) {
      const grayValue = (x + y) / scale;
      const i = (y * g_imageBuffer.m_width + x) * 4;

      // Set RGBA values (all channels same for grayscale)
      g_imageBuffer.m_data[i] = grayValue;     // Red
      g_imageBuffer.m_data[i + 1] = grayValue; // Green
      g_imageBuffer.m_data[i + 2] = grayValue; // Blue
      g_imageBuffer.m_data[i + 3] = 255;       // Alpha (fully opaque)
    }
  }

  newImage();

  g_boundingBox = findBoundingBox();
  logMessage('info', `default bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  renderImageToCanvas();
};

// Load an image from a file.
// Does not affect the text buffer
function loadImage(img) 
{
  // Hide the drop zone
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'none';
  }

  // resize the image buffer to the image size
  g_imageBuffer = new ImageBuffer(img.width, img.height);

  // create a canvas the same size as the image
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width  = img.width;
  imageCanvas.height = img.height;
  const imageCtx = imageCanvas.getContext('2d');

  // draw the image on the image canvas
  imageCtx.drawImage(img, 0, 0);

  // get the image data from the image canvas
  const imageData = imageCtx.getImageData(0, 0, img.width, img.height);

  // copy the image data to the image buffer
  g_imageBuffer.m_data.set(imageData.data);

  logMessage('debug', `image loaded: ${img.width}x${img.height}`);

  newImage()
}

// common code for default image and image loaded from a file
function newImage() {

  logMessage('info', `newImage()`);
    
  g_imageBuffer.setDefaultScale(g_engraveBuffer.m_width, g_engraveBuffer.m_height);

  logMessage('info', `image scale: ${g_imageBuffer.m_imageScale}`);
  logMessage('info', `image offset: ${g_imageBuffer.m_imageOffsetX}, ${g_imageBuffer.m_imageOffsetY}`);
  logMessage('info', `image rotate: ${g_imageBuffer.m_rotateAngle}`);
  logMessage('info', `image threshold: ${g_imageBuffer.m_threshold}`);
  
  // Update threshold slider to current value
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdValue = document.getElementById('thresholdValue');
  thresholdSlider.value = g_imageBuffer.m_threshold;
  thresholdValue.textContent = g_imageBuffer.m_threshold;
  
  // Log success
  logMessage('info', `new image ${g_imageBuffer.m_width}x${g_imageBuffer.m_height}`);
  
  // render the image to the canvas
  renderImageToCanvas();

  g_boundingBox = findBoundingBox();
  logMessage('info', `default bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);
}


// render the image buffer and text buffer to the engrave buffer
function renderImageToEngraveBuffer() 
{
  if (!g_engraveBuffer) {
    logMessage('error', 'Image buffers not initialized');
    return;
  }

  // Create a canvas the size of the engrave buffer
  const engraveCanvas = document.createElement('canvas');
  engraveCanvas.width  = g_engraveBuffer.m_width;
  engraveCanvas.height = g_engraveBuffer.m_height;
  const engraveCtx = engraveCanvas.getContext('2d');

  if (g_imageBuffer) {
    g_imageBuffer.renderToCanvas(engraveCtx);
  }

  if (g_textImageBuffer) {
    g_textImageBuffer.renderToCanvas(engraveCtx);
  }

  // Copy the result into g_engraveBuffer.m_data
  const resultImageData = engraveCtx.getImageData(0, 0, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  g_engraveBuffer.m_data.set(resultImageData.data);

  // find the bounding box of the engraved image
  g_boundingBox = findBoundingBox();
  logMessage('info', `image bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  return engraveCanvas;
}

// render the image buffer to the canvas
function renderImageToCanvas() 
{
  const engraveCanvas = renderImageToEngraveBuffer();

  // clear the bitmap portion of the canvas
  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');

  // convert bounding box to canvas coordinates
  const canvasScale = g_bitmapWidth / g_engraveBuffer.m_width;
  const bitmapBoundingBox = {
    left:   Math.floor(g_boundingBox.left * canvasScale),
    top:    Math.floor(g_boundingBox.top * canvasScale),
    right:  Math.floor(g_boundingBox.right * canvasScale),
    bottom: Math.floor(g_boundingBox.bottom * canvasScale)
  };

  ctx.save();
  ctx.translate(BORDER, BORDER);

  // clear the bitmap canvas
  //ctx.clearRect(0, 0, g_bitmapWidth, g_bitmapHeight);

  // fill the canvas with white
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, g_bitmapWidth, g_bitmapHeight);

  ctx.drawImage(engraveCanvas, 

                 // source coordinates
                 g_boundingBox.left, g_boundingBox.top, 
                 g_boundingBox.right - g_boundingBox.left, 
                 g_boundingBox.bottom - g_boundingBox.top,

                 // destination coordinates
                 bitmapBoundingBox.left, bitmapBoundingBox.top, 
                 bitmapBoundingBox.right - bitmapBoundingBox.left, 
                 bitmapBoundingBox.bottom - bitmapBoundingBox.top);

  // Draw center lines
  ctx.save();  // Save the current context state
  
  // Set fill style for both lines
  ctx.fillStyle = 'red';

  // Vertical center line - draw as a filled rectangle
  ctx.fillRect(g_bitmapWidth/2 - 0.5, 0, 1, g_bitmapHeight);

  // Horizontal center line - draw as a filled rectangle
  ctx.fillRect(0, g_bitmapHeight/2 - 0.5, g_bitmapWidth, 1);

  ctx.restore();  // Restore the previous context state

  // draw the outline of the bounding box
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 1;
  ctx.strokeRect(bitmapBoundingBox.left, bitmapBoundingBox.top, 
                 bitmapBoundingBox.right - bitmapBoundingBox.left, 
                 bitmapBoundingBox.bottom - bitmapBoundingBox.top);

  ctx.restore();

  // Redraw scale indicators
  drawScaleIndicators();
}

// find the bounding box of the engraver image
function findBoundingBox()
{
  // search from top of engraver image for the top non-white pixel and leftmost non-white pixel
  let found = false;
  let topy = -1;
  let leftx = -1;
  for (let y = 0; y < g_engraveBuffer.m_height; y++) {
    for (let x = 0; x < g_engraveBuffer.m_width; x++) {
      const index = (y * g_engraveBuffer.m_width + x) * 4;

      const grayData = g_engraveBuffer.m_data[index];
      const alphaData = g_engraveBuffer.m_data[index + 3];  
      const pixelSet = (alphaData != 0) && (grayData != 255);

      if (pixelSet) {
        if (topy == -1) {
          topy = y;
        }
        if ((leftx == -1) || (x < leftx)) {
          leftx = x;
        }
      }
    }
  }

  // search from bottom of engraver image for the bottom non-white pixel and rightmost non-white pixel
  found = false;
  let bottomy = -1;
  let rightx = -1;
  for (let y = g_engraveBuffer.m_height - 1; y >= 0; y--) {
    for (let x = g_engraveBuffer.m_width - 1; x >= 0; x--) {  
      const index = (y * g_engraveBuffer.m_width + x) * 4;

      const grayData = g_engraveBuffer.m_data[index];
      const alphaData = g_engraveBuffer.m_data[index + 3];  
      const pixelSet = (alphaData != 0) && (grayData != 255);

      if (pixelSet) {
        if (bottomy == -1) {
          bottomy = y;
        }
        if ((rightx == -1) || (rightx < x)) { 
          rightx = x;
        }
      }
    }
  }

  return { left: leftx, top: topy, right: rightx, bottom: bottomy }; 
}


// Add event listeners for threshold controls
document.addEventListener('DOMContentLoaded', () => {
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdInput = document.getElementById('thresholdInput');
    const thresholdValue = document.getElementById('thresholdValue');

    // Update both slider and input when slider changes
    thresholdSlider.addEventListener('input', (e) => {
      if (g_imageBuffer) {
        let value = parseInt(e.target.value); 
        value = Math.max(0, Math.min(255, value));
        thresholdInput.value = value;
        thresholdValue.textContent = value;
        g_imageBuffer.m_threshold = value;
      }
    });

    // Update both slider and display when input changes
    thresholdInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // Clamp value between min and max
        value = Math.max(0, Math.min(255, value));
        thresholdSlider.value = value;
        thresholdValue.textContent = value;
        g_imageBuffer.m_threshold = value;
    });

    // Handle enter key in input field
    thresholdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // Remove focus from input
        }
    });
});

// Add event listeners for scale controls
document.addEventListener('DOMContentLoaded', () => {
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleInput = document.getElementById('scaleInput');
    const scaleValue = document.getElementById('scaleValue');

    // Update both slider and input when slider changes
    scaleSlider.addEventListener('input', (e) => {
      if (g_imageBuffer) {
        const value = parseInt(e.target.value);
        scaleInput.value = value;
        scaleValue.textContent = value;
        g_imageBuffer.m_imageScale = g_imageBuffer.m_maxImageScale * value / 100;
        renderImageToCanvas();
      }
    });

    // Update both slider and display when input changes
    scaleInput.addEventListener('input', (e) => {
      if (g_imageBuffer) {  
        let value = parseInt(e.target.value);
        // Clamp value between min and max
        value = Math.max(10, Math.min(200, value));
        scaleSlider.value = value;
        scaleValue.textContent = value;
        g_imageBuffer.m_imageScale = g_imageBuffer.m_maxImageScale * value / 100;
        renderImageToCanvas();
      }
    });

    // Handle enter key in input field
    scaleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // Remove focus from input
        }
    });
});

// Rotate the image
function rotate(angle) {
    // Store current center position
    const centerX = this.m_imageOffsetX + (this.m_width / 2);
    const centerY = this.m_imageOffsetY + (this.m_height / 2);

    // Update rotation angle
    this.m_rotateAngle = (this.m_rotateAngle + angle) % 360;
    if (this.m_rotateAngle < 0) {
        this.m_rotateAngle += 360;
    }

    // Swap width and height if rotating 90 or 270 degrees
    if (angle === 90 || angle === -90 || angle === 270 || angle === -270) {
        const temp = this.m_width;
        this.m_width = this.m_height;
        this.m_height = temp;
    }

    // Adjust position to maintain center point
    this.m_imageOffsetX = centerX - (this.m_width / 2);
    this.m_imageOffsetY = centerY - (this.m_height / 2);
};

