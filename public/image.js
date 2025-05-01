
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


// load image from image object
function loadImage(img) {

  // resize the image buffer to the image size
  createImageBuffer(img.width, img.height);

  // clear the image buffer
  g_imageBuffer.clear();

  // Create a temporary canvas so we can get the image data
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');

  // Get image data and copy to our buffer
  const imageData = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height);
  g_imageBuffer.data.set(imageData.data);
  
  // calculate initial scaling factor to display the image on the canvas
  const canvas = document.getElementById('bitmapCanvas');

  g_displayScale = Math.min(
    canvas.width / img.width,
    canvas.height / img.height
  );

  // Render to visible canvas
  renderBufferToCanvas();
};
  

// Function to render the buffer to the canvas with scaling
function renderBufferToCanvas() {

  // get display canvas
  const canvas = document.getElementById('bitmapCanvas');

  // get context
  const ctx = canvas.getContext('2d');

  // get display canvas dimensions
  const displayWidth  = canvas.width;
  const displayHeight = canvas.height;

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
  const scaledWidth  = g_imageBuffer.width * g_displayScale;
  const scaledHeight = g_imageBuffer.height * g_displayScale;
  const offsetX      = (canvas.width - scaledWidth) / 2;
  const offsetY      = (canvas.height - scaledHeight) / 2;

  ctx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
}

