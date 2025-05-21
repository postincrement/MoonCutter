const BORDER = 18;
const BITMAP_SIZE = 512;
const CANVAS_SIZE = BITMAP_SIZE + BORDER;  // width and height of the canvas

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
let g_boundingBox  = null;
let g_rotateAngle  = 0;

// image buffer loaded from a file or created from text
g_loadedImageBuffer = null;

// image buffer to be engraved
g_engraveBuffer = null;

// create a default image. Used on start
function setDefaultImage() 
{
  logMessage('info', `setDefaultImage()`);

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

  logMessage('info', `newImage()`);

  // Calculate scaling to fit image into engraving buffer while maintaining aspect ratio and zero rotation
  g_rotateAngle = 0;
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

  // scale the image
  const scaleCanvas     = scaleImage();

  // rotate the image
  const transformCanvas = rotateImage(scaleCanvas);

  // Create a canvas the size of the engrave buffer
  const engraveCanvas = document.createElement('canvas');
  engraveCanvas.width  = g_engraveBuffer.m_width;
  engraveCanvas.height = g_engraveBuffer.m_height;
  const engraveCtx = engraveCanvas.getContext('2d');

  // Fill the canvas with white
  engraveCtx.fillStyle = 'white';
  engraveCtx.fillRect(0, 0, engraveCanvas.width, engraveCanvas.height);

  // Draw the image onto the engrave canvas
  engraveCtx.drawImage(
    transformCanvas,
    0, 0, transformCanvas.width, transformCanvas.height,
    g_imageOffsetX, g_imageOffsetY, transformCanvas.width, transformCanvas.height
  );

  // Copy the result into g_engraveBuffer.m_data
  const resultImageData = engraveCtx.getImageData(0, 0, g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  g_engraveBuffer.m_data.set(resultImageData.data);

  // find the bounding box of the engraved image
  g_boundingBox = findBoundingBox();
  logMessage('info', `image bounding box: ${g_boundingBox.left}, ${g_boundingBox.top}, ${g_boundingBox.right}, ${g_boundingBox.bottom}`);

  return engraveCanvas;
}

function scaleImage()
{
  // load the raw image data into a new ImageData object
  const loadedImageData = new ImageData(g_loadedImageBuffer.m_data, g_loadedImageBuffer.m_width, g_loadedImageBuffer.m_height);

  // create a canvas the same size as the loaded image
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width  = g_loadedImageBuffer.m_width;
  sourceCanvas.height = g_loadedImageBuffer.m_height;
  const sourceCtx = sourceCanvas.getContext('2d');

  // put the image data into the source canvas
  sourceCtx.putImageData(loadedImageData, 0, 0);

  // create a canvas the same size as the scaled image
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width  = g_loadedImageBuffer.m_width * g_imageScale;
  scaledCanvas.height = g_loadedImageBuffer.m_height * g_imageScale;
  const scaledCtx = scaledCanvas.getContext('2d');

  // scale image to the scaled canvas
  scaledCtx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  // get the transformed image data
  return scaledCanvas;
}

function rotateImage(sourceCanvas) 
{
  const radians = degreesToRadians(g_rotateAngle);

  // calculate size of rotated image
  const rotatedWidth  = Math.round(Math.abs(sourceCanvas.width * Math.cos(radians)) + Math.abs(sourceCanvas.height * Math.sin(radians)));
  const rotatedHeight = Math.round(Math.abs(sourceCanvas.width * Math.sin(radians)) + Math.abs(sourceCanvas.height * Math.cos(radians)));

  logMessage('info', `rotated by ${g_rotateAngle} degrees: ${rotatedWidth}x${rotatedHeight}`);

  // Create a temporary canvas for the destination image
  const rotatedCanvas = document.createElement('canvas');
  const rotatedCtx = rotatedCanvas.getContext('2d');
  rotatedCanvas.width  = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;

  logMessage('info', `rotated canvas size: ${rotatedWidth}x${rotatedCanvas.height}`);

  // draw the source canvas onto the destination canvas with rotation
  rotatedCtx.save();
  rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rotatedCtx.rotate(radians);
  rotatedCtx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  rotatedCtx.restore();

  return rotatedCanvas;
}

// render the image buffer to the canvas
function renderImageToCanvas() 
{
  const engraveCanvas = renderImageToEngraveBuffer();

  // clear the bitmap portion of the canvas
  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.translate(BORDER, BORDER);

  // draw the engrave buffer image on the canvas
  ctx.clearRect(0, 0, g_bitmapWidth, g_bitmapHeight);
  ctx.drawImage(engraveCanvas, 0, 0, g_bitmapWidth, g_bitmapHeight);

  // Draw center lines
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 1;

  // Vertical center line
  ctx.beginPath();
  ctx.moveTo(g_bitmapWidth/2, 0);
  ctx.lineTo(g_bitmapWidth/2, g_bitmapHeight);
  ctx.stroke();

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(0,             g_bitmapHeight/2);
  ctx.lineTo(g_bitmapWidth, g_bitmapHeight/2);
  ctx.stroke();

  // convert bounding box to canvas coordinates
  const canvasScale = g_bitmapWidth / g_engraveBuffer.m_width;
  const bitmapBoundingBox = {
    left:   Math.floor(g_boundingBox.left * canvasScale),
    top:    Math.floor(g_boundingBox.top * canvasScale),
    right:  Math.floor(g_boundingBox.right * canvasScale),
    bottom: Math.floor(g_boundingBox.bottom * canvasScale)
  };

  // draw the outline of the bounding box
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 1;
  ctx.strokeRect(bitmapBoundingBox.left, bitmapBoundingBox.top, 
                 bitmapBoundingBox.right - bitmapBoundingBox.left, 
                 bitmapBoundingBox.bottom - bitmapBoundingBox.top);

  ctx.restore();
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

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function adjustOffsetAfterRotation()
{
  // calculate the scaled width and height
  const scaledWidth  = Math.round(g_loadedImageBuffer.m_width * g_imageScale);
  const scaledHeight = Math.round(g_loadedImageBuffer.m_height * g_imageScale);

  logMessage('info', `--------------------------------`);

  logMessage('info', `scaled width: ${scaledWidth}, scaled height: ${scaledHeight}`);

  // calculate the rotated width
  const rotatedWidth  = Math.round(Math.abs(scaledWidth * Math.cos(degreesToRadians(g_rotateAngle))) + Math.abs(scaledHeight * Math.sin(degreesToRadians(g_rotateAngle))));
  const rotatedHeight = Math.round(Math.abs(scaledWidth * Math.sin(degreesToRadians(g_rotateAngle))) + Math.abs(scaledHeight * Math.cos(degreesToRadians(g_rotateAngle))));

  logMessage('info', `angle: ${g_rotateAngle}, rotated width: ${rotatedWidth}, rotated height: ${rotatedHeight}`);

  // calculate the offset to center the image on the engrave buffer
  g_imageOffsetX = Math.round((g_engraveBuffer.m_width - rotatedWidth) / 2);
  g_imageOffsetY = Math.round((g_engraveBuffer.m_height - rotatedHeight) / 2);

  logMessage('info', `adjusted offset: ${g_imageOffsetX}, ${g_imageOffsetY}`);

  logMessage('info', `--------------------------------`);
}

