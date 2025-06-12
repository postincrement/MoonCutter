/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let g_imageSettings = {
  m_rotateAngle: 0,
  m_imageOffsetX: 0,
  m_imageOffsetY: 0,
  m_imageScale: 1,
  m_invert: false,
  m_dither: false,
  m_threshold: 128,
  m_scale: 100,
  m_flipHorizontal: false,
  m_flipVertical: false
};

// scale

g_scaleSlider.addEventListener('input', () => {
  setNewScale(parseInt(g_scaleSlider.value));
});

// Update both slider and display when input changes
g_scaleInput.addEventListener('input', (e) => {
  setNewScale(parseInt(e.target.value));
})

// Handle enter key in input field
g_scaleInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
      e.target.blur(); // Remove focus from input
  }
});

function setNewScale(value) {
  const percentage = Math.max(10, Math.min(200, value));
  g_scaleSlider.value          = percentage;
  g_scaleInput.value           = percentage;
  g_imageSettings.m_imageScale = percentage / 100.0;
  renderImageToScreen();
}

// threshold

g_thresholdSlider.addEventListener('input', () => {
  setNewThreshold(parseInt(g_thresholdSlider.value));
});

// Update both slider and display when input changes
g_thresholdInput.addEventListener('input', (e) => {
  setNewThreshold(parseInt(e.target.value));
});

// Handle enter key in input field
g_thresholdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
      e.target.blur(); // Remove focus from input
  }
});

function setNewThreshold(value) {
  g_imageSettings.m_threshold = Math.max(0, Math.min(255, value));
  g_thresholdSlider.value = value;
  g_thresholdInput.value = value;
  renderImageToScreen();
}

// rotate controls
g_rotateImageLeftButton.addEventListener('click', () => {
  g_imageSettings.m_rotateAngle -= 90;
  if (g_imageSettings.m_rotateAngle < 0) {
    g_imageSettings.m_rotateAngle += 360;
  }
  if (g_imageBuffer) {
    g_imageBuffer.adjustOffsetAfterRotation(g_imageSettings, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  renderImageToScreen();
});

g_rotateImageRightButton.addEventListener('click', () => {
  g_imageSettings.m_rotateAngle += 90;
  if (g_imageSettings.m_rotateAngle >= 360) {
    g_imageSettings.m_rotateAngle -= 360;
  }
  if (g_imageBuffer) {
    g_imageSettings = g_imageBuffer.adjustOffsetAfterRotation(g_imageSettings, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  renderImageToScreen();
});

// dither button
g_ditherButton.addEventListener('click', () => {
    g_ditherButton.classList.toggle('active');
    g_imageSettings.m_dither = g_ditherButton.classList.contains('active');
    logMessage('debug', `dithering: ${g_imageSettings.m_dither}`);
    renderImageToScreen();
});

// invert button
g_invertImageButton.addEventListener('click', () => {
  g_invertImageButton.classList.toggle('active');
  g_imageSettings.m_invert = g_invertImageButton.classList.contains('active');
  renderImageToScreen();
});

// Flip image horizontally
g_flipImageHorizontalButton.addEventListener('click', () => {
    g_imageSettings.m_flipHorizontal = !g_imageSettings.m_flipHorizontal;
    g_flipImageHorizontalButton.classList.toggle('active');
    renderImageToScreen();
});

// Flip image vertically
g_flipImageVerticalButton.addEventListener('click', () => {
    g_imageSettings.m_flipVertical = !g_imageSettings.m_flipVertical;
    g_flipImageVerticalButton.classList.toggle('active');
    renderImageToScreen();
});

// load image from file
g_loadImageButton.addEventListener('click', async () => {
  try {
    const filePath = await window.api.openFileDialog();
    if (!filePath) 
      return;
    
    // Load image into a temp img element
    const img = new Image();
    img.onload = () => {
      loadImage(img);
    }
    img.onerror = () => {
      logMessage('error', `Failed to load image ${filePath}`);
    };    
    img.src = filePath;
  } catch (err) {
    logMessage('error', `Failed to load image: ${err.message}`);
  }
});

// clear image
g_clearImageButton.addEventListener('click', () => {
  g_imageBuffer = null;
  renderImageToScreen();
});


// create a default image and remove any text. Used on start
function setDefaultImage()
{
  //logMessage('debug', `setDefaultImage()`);

  g_textImageBuffer = null;

  if (g_engraveBuffer) {
    //logMessage('debug', `image buffer size is ${g_engraveBuffer.m_width}x${g_engraveBuffer.m_height}`);
    g_imageBuffer = new ImageBuffer(g_engraveBuffer.m_width, g_engraveBuffer.m_height, false);
  }
  else {
    g_imageBuffer = new ImageBuffer(512, 512, false);
    logMessage('error', 'engrave buffer not initialized using default size is 512x512');
  }

  g_imageBuffer.m_default     = true;

  //logMessage('debug', `default image size is ${g_imageBuffer.m_width}x${g_imageBuffer.m_height}`);

  const scale = Math.floor((g_imageBuffer.m_height + g_imageBuffer.m_width) / 256);
  //logMessage('debug', `scale: ${scale}`);

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
  //logMessage('debug', `default bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  renderImageToScreen();
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
  g_imageBuffer = new ImageBuffer(img.width, img.height, false, g_imageSettings.invert);

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

  //logMessage('debug', `newImage()`);
    
  g_imageSettings = g_imageBuffer.setDefaultScale(g_imageSettings, g_engraveBuffer.m_width, g_engraveBuffer.m_height);

  // Log success
  logMessage('info', `new image ${g_imageBuffer.m_width}x${g_imageBuffer.m_height}`);
  
  // render the image to the canvas
  renderImageToScreen();

  g_boundingBox = findBoundingBox();
  logMessage('info', `default bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);
}


// render the image buffer and text buffer to the engrave buffer
function renderToEngraveBuffer() 
{
  if (!g_engraveBuffer) {
    logMessage('error', 'Image buffers not initialized');
    return;
  }

  // Create a canvas the size of the engrave buffer
  const engraveCanvas = document.createElement('canvas');
  engraveCanvas.width  = g_engraveBuffer.m_width;
  engraveCanvas.height = g_engraveBuffer.m_height;
  const engraveCtx = engraveCanvas.getContext('2d', { willReadFrequently: true });

  // set alpha to 0
  engraveCtx.globalAlpha = 0;
  engraveCtx.fillStyle = '#FFFFFF';
  engraveCtx.fillRect(0, 0, g_engraveBuffer.m_width, g_engraveBuffer.m_height);

  // set alpha to 1
  engraveCtx.globalAlpha = 1;

  if (g_imageBuffer) {
    logMessage('debug', `rendering image to engrave buffer`);
    g_imageBuffer.renderToCanvas(g_imageSettings, engraveCtx);
  }

  if (g_textImageBuffer) {
    logMessage('debug', `rendering text to engrave buffer`);
    g_textImageBuffer.renderToCanvas(g_textSettings, engraveCtx);
  }

  // Apply threshold to the image
  applyThreshold(engraveCtx, engraveCanvas.width, engraveCanvas.height, g_imageSettings.m_dither, g_imageSettings.m_threshold);

  // Copy the result into g_engraveBuffer.m_data
  const resultImageData = engraveCtx.getImageData(0, 0, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  g_engraveBuffer.m_data.set(resultImageData.data);

  // find the bounding box of the engraved image
  g_boundingBox = findBoundingBox();
  //logMessage('debug', `image bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  return engraveCanvas;
}

// Add threshold processing function
function applyThreshold(sourceCtx, width, height, dithering, threshold) 
{
  // get the image data from the source canvas
  const sourceData = sourceCtx.getImageData(0, 0, width, height);  

  // get the image data from the threshold canvas
  const destinationData = new ImageData(sourceData.data, width, height);

  // create a new array to store the error for dithering
  var nextError = new Array(width);
  nextError.fill(0);

  // apply the threshold to the threshold canvas
  for (let y = 0; y < height; y++) {

    var thisError = nextError;
    nextError = new Array(width);
    nextError.fill(0);
    for (let x = 0; x < width; x++) {

      const i = (y * width + x) * 4;

      // calculate the gray value
      var grayValue = Math.round(
        0.299 * sourceData.data[i] +
        0.587 * sourceData.data[i + 1] +
        0.114 * sourceData.data[i + 2]
      );  

      if (sourceData.data[i+3] == 0) {
        grayValue = 255;
      }

      var thresholdedValue;

      // if enabled, apply floyd-steinberg dithering
      if (!dithering) {
        thresholdedValue = grayValue <= threshold ? 0 : 255;
      }
      else {

        // calculate the thresholded value
        grayValue += thisError[x];

        // apply the error to the thresholded value
        thresholdedValue = grayValue <= threshold ? 0 : 255;

        // apply floyd-steinberg dithering
        const error = (grayValue - thresholdedValue) / 16;

        if (thresholdedValue > 255) {
          thresholdedValue = 255;
        }
        if (thresholdedValue < 0) {
          thresholdedValue = 0;
        }

        // apply to this row
        if (x < width - 1) {
          thisError[x + 1] += error * 7;
        }

        // apply to next row
        if (y < height - 1) {
          if (x > 0) {
            nextError[x - 1] += error * 3;
          }
          nextError[x] += error * 5;
          if (x < width - 1) {
            nextError[x + 1] += error * 1;
          }
        }
      }

      const alpha = thresholdedValue == 0 ? 255 : 0;

      // set the thresholded value
      destinationData.data[i] = thresholdedValue;     // Red
      destinationData.data[i + 1] = thresholdedValue; // Green
      destinationData.data[i + 2] = thresholdedValue; // Blue  
      destinationData.data[i + 3] = alpha;            // Alpha
    }
  }

  // copy the thresholded image data back to the source canvas
  sourceCtx.putImageData(destinationData, 0, 0);
}


// Add event listeners for threshold controls
document.addEventListener('DOMContentLoaded', () => {

});

// Rotate the image
function rotate(angle) 
{
    // Store current center position
    const centerX = g_imageBuffer.m_imageOffsetX + (g_imageBuffer.m_width / 2);
    const centerY = g_imageBuffer.m_imageOffsetY + (g_imageBuffer.m_height / 2);

    // Update rotation angle
    g_imageSettings.rotate = (g_imageSettings.rotate + angle) % 360;
    if (g_imageSettings.rotate < 0) {
        g_imageSettings.rotate += 360;
    }

    // Swap width and height if rotating 90 or 270 degrees
    if (angle === 90 || angle === -90 || angle === 270 || angle === -270) {
        const temp = g_imageBuffer.m_width;
        g_imageBuffer.m_width = g_imageBuffer.m_height;
        g_imageBuffer.m_height = temp;
    }

    // Adjust position to maintain center point
    g_imageBuffer.m_imageOffsetX = centerX - (g_imageBuffer.m_width / 2);
    g_imageBuffer.m_imageOffsetY = centerY - (g_imageBuffer.m_height / 2);
};

