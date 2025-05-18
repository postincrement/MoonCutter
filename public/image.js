// ImageBuffer class

class ImageBuffer {
  constructor(width, height) {
    this.m_default = false;
    this.m_width   = width;
    this.m_height  = height;
    this.m_data    = new Uint8ClampedArray(width * height * 4);
    this.clear();
  }

  clear() {
    this.m_data.fill(0); // Fill with transparent black
  }
}

let g_imageOffsetX = 0;
let g_imageOffsetY = 0;
let g_imageScale   = 1;
let g_maxImageScale = 1;
let g_boundingBox = null;

// image buffer loaded from a file or created from text
g_loadedImageBuffer = null;

// image buffer to be engraved
g_engraveBuffer = null;

// create a default image. Used on start
function setDefaultImage() 
{
  if (g_engraveBuffer) {
    logMessage('info', `engrave buffer size is ${g_engraveBuffer.m_width}x${g_engraveBuffer.m_height}`);
    g_loadedImageBuffer = new ImageBuffer(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  else {
    logMessage('error', 'engrave buffer not initialized');
    g_loadedImageBuffer = new ImageBuffer(512, 512);
  }

  g_loadedImageBuffer.m_default = true;

  logMessage('info', `default image size is ${g_loadedImageBuffer.m_width}x${g_loadedImageBuffer.m_height}`);

  const scale = Math.floor((g_loadedImageBuffer.m_height + g_loadedImageBuffer.m_width) / 256);
  logMessage('info', `scale: ${scale}`);
  // Create a grayscale gradient pattern directly in the buffer
    for (let y = 0; y < g_loadedImageBuffer.m_height; y++) {
      for (let x = 0; x < g_loadedImageBuffer.m_width; x++) {
        const grayValue = (x + y) / scale;
        const i = (y * g_loadedImageBuffer.m_width + x) * 4;

        // Set RGBA values (all channels same for grayscale)
        g_loadedImageBuffer.m_data[i] = grayValue;     // Red
        g_loadedImageBuffer.m_data[i + 1] = grayValue; // Green
        g_loadedImageBuffer.m_data[i + 2] = grayValue; // Blue
        g_loadedImageBuffer.m_data[i + 3] = 255;       // Alpha (fully opaque)
      }
    }

  newImage();

  g_boundingBox = findBoundingBox();
  logMessage('info', `default bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  renderImageToCanvas();
};

// load an image from a file
function loadImage(img) 
{
  // resize the image buffer to the image size
  g_loadedImageBuffer = new ImageBuffer(img.width, img.height);

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
  g_loadedImageBuffer.m_data.set(imageData.data);

  logMessage('debug', `image loaded: ${img.width}x${img.height}`);

  newImage()
}

function newImage() 
{
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

  // Calculate scaling to fit image into engraving buffer while maintaining aspect ratio
  if (g_loadedImageBuffer.m_width > g_loadedImageBuffer.m_height) {
    g_maxImageScale = g_engraveBuffer.m_width / g_loadedImageBuffer.m_width;
    g_imageOffsetX = 0;
    g_imageOffsetY = (g_engraveBuffer.m_height - g_loadedImageBuffer.m_height * g_maxImageScale) / 2;
  }
  else {
    g_maxImageScale = g_engraveBuffer.m_height / g_loadedImageBuffer.m_height;
    g_imageOffsetX = (g_engraveBuffer.m_width - g_loadedImageBuffer.m_width * g_maxImageScale) / 2;
    g_imageOffsetY = 0;
  }
  g_imageScale = g_maxImageScale;

  // Log success
  logMessage('info', `new image ${g_loadedImageBuffer.m_width}x${g_loadedImageBuffer.m_height}`);

  // render the image to the canvas
  renderImageToCanvas();
}

// render the image buffer to the engrave buffer
function renderImageToEngraveBuffer() 
{
  if (!g_loadedImageBuffer || !g_engraveBuffer) {
    logMessage('error', 'Image buffers not initialized');
    return;
  }

  // load the raw image data into a new ImageData object
  const loadedImageData = new ImageData(g_loadedImageBuffer.m_data, g_loadedImageBuffer.m_width, g_loadedImageBuffer.m_height);

  // create a canvas the same size as the loaded image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = g_loadedImageBuffer.m_width;
  tempCanvas.height = g_loadedImageBuffer.m_height;
  const tempCtx = tempCanvas.getContext('2d');

  // put the image data into the temp canvas
  tempCtx.putImageData(loadedImageData, 0, 0);
  
  // Create a canvas the size of the engrave buffer
  const engraveCanvas = document.createElement('canvas');
  engraveCanvas.width  = g_engraveBuffer.m_width;
  engraveCanvas.height = g_engraveBuffer.m_height;
  const engraveCtx = engraveCanvas.getContext('2d');

  // Fill the canvas with white
  engraveCtx.fillStyle = 'white';
  engraveCtx.fillRect(0, 0, engraveCanvas.width, engraveCanvas.height);

  // Calculate scaled width of image 
  const scaledWidth  = g_loadedImageBuffer.m_width * g_imageScale;
  const scaledHeight = g_loadedImageBuffer.m_height * g_imageScale;

  // Draw the loaded image onto the engrave canvas, scaled and at the appropriate offset
  engraveCtx.drawImage(
    tempCanvas,
    0, 0, g_loadedImageBuffer.m_width, g_loadedImageBuffer.m_height,
    g_imageOffsetX, g_imageOffsetY, scaledWidth, scaledHeight
  );

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

  // clear the canvas
  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw the engrave buffer image on the canvas
  ctx.drawImage(engraveCanvas, 0, 0, canvas.width, canvas.height);

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

  // convert bounding box to canvas coordinates
  const canvasScale = canvas.width / g_engraveBuffer.m_width;
  const canvasBoundingBox = {
    left:g_boundingBox.left * canvasScale,
    top: g_boundingBox.top * canvasScale,
    right: g_boundingBox.right * canvasScale,
    bottom: g_boundingBox.bottom * canvasScale
  };

  // draw the outline of the bounding box
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.strokeRect(canvasBoundingBox.left, canvasBoundingBox.top, canvasBoundingBox.right - canvasBoundingBox.left, canvasBoundingBox.bottom - canvasBoundingBox.top);
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
