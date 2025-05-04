let g_displayScale = 1;

// Declare internal image buffer 
function createImageBuffer(width, height)
{
  g_imageBuffer.width   = width;
  g_imageBuffer.height  = height;
  g_imageBuffer.data    = new Uint8ClampedArray(width * height * 4);
  g_imageBuffer.clear();
}

// Load and process image file
function loadImageFromFile(file) {

  const reader = new FileReader();
  
  reader.onload = function(e) {

      const img = new Image();
      img.onload = function() {
        loadImage(img);
      }
      img.src = e.target.result;
  };
  
  reader.readAsDataURL(file);
}
function loadImage(img) {

  // resize the image buffer to the image size
  createImageBuffer(img.width, img.height);

  // Create a temporary canvas to extract image data
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');

  // Calculate scaling to fit image into buffer while maintaining aspect ratio
  const canvas = document.getElementById('bitmapCanvas');
  g_displayScale = Math.min(
    canvas.width / img.width,
    canvas.height / img.height
  );

  // Calculate centered position
  const scaledWidth = img.width * g_displayScale;
  const scaledHeight = img.height * g_displayScale;
  const offsetX = (g_imageBuffer.width - scaledWidth) / 2;
  const offsetY = (g_imageBuffer.height - scaledHeight) / 2;

  // Clear the temporary canvas with white
  tempCtx.fillStyle = 'white';
  tempCtx.fillRect(0, 0, g_imageBuffer.width, g_imageBuffer.height);

  // Draw the scaled image centered on the temporary canvas
  //tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
  tempCtx.drawImage(img, 0, 0, img.width, img.height);

  g_imageBuffer.data = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height).data;

  /*
  // Convert to grayscale and store in g_imageBuffer
  const imageData = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height);
  
  // Process each pixel
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Convert RGB to grayscale using luminance formula
    const grayValue = Math.round(
      0.299 * data[i] +      // Red
      0.587 * data[i + 1] +  // Green
      0.114 * data[i + 2]    // Blue
    );

    // Store grayscale value in all RGB channels of g_imageBuffer
    g_imageBuffer.data[i] = grayValue;     // Red
    g_imageBuffer.data[i + 1] = grayValue; // Green
    g_imageBuffer.data[i + 2] = grayValue; // Blue
    g_imageBuffer.data[i + 3] = 255;       // Alpha (fully opaque)
  }
*/

  // Render the buffer to the canvas
  renderBufferToCanvas();

  // Log success
  logToWindow('info', `Image loaded and converted: ${img.width}x${img.height} -> ${g_imageBuffer.width}x${g_imageBuffer.height}`);
}

function renderBufferToCanvas() {
  
  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');

  // Create ImageData from our buffer
  const imageData = new ImageData(g_imageBuffer.data, g_imageBuffer.width, g_imageBuffer.height);

  // Create a temporary canvas to hold the full-size image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);

  // Clear main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw scaled image centered in canvas
  const scaledWidth = g_imageBuffer.width * g_displayScale;
  const scaledHeight = g_imageBuffer.height * g_displayScale;
  const offsetX = (canvas.width - scaledWidth) / 2;
  const offsetY = (canvas.height - scaledHeight) / 2;

  ctx.save();
  ctx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.restore();

  // Draw center lines
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 1;

  // Vertical center line
  ctx.beginPath();
  ctx.moveTo(canvas.width/2, 0);
  ctx.lineTo(canvas.width/2, canvas.height);
  ctx.stroke();

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(0, canvas.height/2);
  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();
} 