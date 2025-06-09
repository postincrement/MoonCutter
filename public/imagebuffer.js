// ImageBuffer class

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

class ImageBuffer 
{
  constructor(width, height) {
    this.m_default = false;
    this.m_width   = width;
    this.m_height  = height;
    this.m_data    = new Uint8ClampedArray(width * height * 4);

    this.m_imageOffsetX = 0;
    this.m_imageOffsetY = 0;
    this.m_imageScale   = 1;
    this.m_maxImageScale = 1;

    this.m_rotateAngle  = 0;
    this.m_threshold    = 128;  // Default threshold value

    this.m_invertImage = false;
    this.m_dithering   = false;
    
    this.clear();
  }

  clear() 
  {
    for (let i = 0; i < this.m_data.length; i+=4) {
      this.m_data[i] = 255;
      this.m_data[i+1] = 255;
      this.m_data[i+2] = 255;
      this.m_data[i+3] = 0;
    }
  }

  setDefaultScale(engraveWidth, engraveHeight) 
  {
    //logMessage('debug', `setDefaultScale(): engrave buffer size: ${engraveWidth}x${engraveHeight}`);
    
    // Calculate scaling to fit image into engraving buffer while maintaining aspect ratio and zero rotation
    this.m_rotateAngle = 0;
    if (this.m_width > this.m_height) {
      this.m_maxImageScale = engraveWidth / this.m_width;
      this.m_imageOffsetX = 0;
      this.m_imageOffsetY = (engraveHeight - this.m_height * this.m_maxImageScale) / 2;
    }
    else {
      this.m_maxImageScale = engraveHeight / this.m_height;
      this.m_imageOffsetX = (engraveWidth - this.m_width * this.m_maxImageScale) / 2;
      this.m_imageOffsetY = 0;
    }
    this.m_imageScale = this.m_maxImageScale;
  }

  applyScale(sourceCanvas)
  {
    // create a canvas the same size as the scaled image
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width  = sourceCanvas.width * this.m_imageScale;
    scaledCanvas.height = sourceCanvas.height * this.m_imageScale;
    const scaledCtx = scaledCanvas.getContext('2d');
  
    // scale image to the scaled canvas
    scaledCtx.save();
    scaledCtx.translate(scaledCanvas.width / 2, scaledCanvas.height / 2);
    scaledCtx.scale(this.m_imageScale, this.m_imageScale);
    scaledCtx.translate(-sourceCanvas.width / 2, -sourceCanvas.height / 2);
    scaledCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    scaledCtx.restore();
  
    //logMessage('debug', `scaled canvas size: ${scaledCanvas.width}x${scaledCanvas.height}`);
  
    // get the transformed image data
    return scaledCanvas;
  }
  
  applyRotation(sourceCanvas) 
  {
    const radians = degreesToRadians(this.m_rotateAngle);
  
    // calculate size of rotated image
    const rotatedWidth  = Math.round(Math.abs(sourceCanvas.width * Math.cos(radians)) + Math.abs(sourceCanvas.height * Math.sin(radians)));
    const rotatedHeight = Math.round(Math.abs(sourceCanvas.width * Math.sin(radians)) + Math.abs(sourceCanvas.height * Math.cos(radians)));
  
    //logMessage('debug', `rotated by ${this.m_rotateAngle} degrees: ${rotatedWidth}x${rotatedHeight}`);
  
    // Create a temporary canvas for the destination image
    const rotatedCanvas = document.createElement('canvas');
    const rotatedCtx = rotatedCanvas.getContext('2d');
    rotatedCanvas.width  = rotatedWidth;
    rotatedCanvas.height = rotatedHeight;
  
    //logMessage('debug', `rotated canvas size: ${rotatedWidth}x${rotatedCanvas.height}`);
  
    // draw the source canvas onto the destination canvas with rotation
    rotatedCtx.save();
    rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedCtx.rotate(radians);
    rotatedCtx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    rotatedCtx.restore();
  
    return rotatedCanvas;
  }  

  // Add threshold processing function
  applyThreshold(sourceCanvas) {
    if (!sourceCanvas) {
      logMessage('warn', 'No source canvas provided to applyThreshold');
      return null;
    }

    // get the image data from the source canvas
    const sourceData = sourceCanvas.getContext('2d').getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);  

    // get the image data from the threshold canvas
    const destinationData = new ImageData(sourceData.data, sourceCanvas.width, sourceCanvas.height);

    // create a new array to store the error for dithering
    var nextError = new Array(sourceCanvas.width);
    nextError.fill(0);

    // apply the threshold to the threshold canvas
    for (let y = 0; y < sourceCanvas.height; y++) {
      var thisError = nextError;
      nextError = new Array(sourceCanvas.width);
      nextError.fill(0);
      for (let x = 0; x < sourceCanvas.width; x++) {

        const i = (y * sourceCanvas.width + x) * 4;

        // calculate the gray value
        var grayValue = Math.round(
          0.299 * sourceData.data[i] +
          0.587 * sourceData.data[i + 1] +
          0.114 * sourceData.data[i + 2]
        );  

        grayValue *= sourceData.data[i+3] / 255;

        // invert the image if the invert image checkbox is checked
        const black = this.m_invertImage ? 255 : 0;
        const white = this.m_invertImage ? 0 : 255;

        var thresholdedValue;

        // if enabled, apply floyd-steinberg dithering
        if (!this.m_dithering) {
          thresholdedValue = grayValue <= this.m_threshold ? black : white;
        }
        else {

          // calculate the thresholded value
          grayValue += thisError[x];

          // apply the error to the thresholded value
          thresholdedValue = grayValue <= this.m_threshold ? black : white;

          // apply floyd-steinberg dithering
          const error = (grayValue - thresholdedValue) / 16;

          if (thresholdedValue > 255) {
            thresholdedValue = 255;
          }
          if (thresholdedValue < 0) {
            thresholdedValue = 0;
          }

          // apply to this row
          if (x < sourceCanvas.width - 1) {
            thisError[x + 1] += error * 7;
          }

          // apply to next row
          if (y < sourceCanvas.height - 1) {
            if (x > 0) {
              nextError[x - 1] += error * 3;
            }
            nextError[x] += error * 5;
            if (x < sourceCanvas.width - 1) {
              nextError[x + 1] += error * 1;
            }
          }
        }

        const alpha = thresholdedValue < 128 ? 255 : 0;

        // set the thresholded value
        destinationData.data[i] = thresholdedValue;     // Red
        destinationData.data[i + 1] = 0; //thresholdedValue; // Green
        destinationData.data[i + 2] = thresholdedValue; // Blue  
        destinationData.data[i + 3] = alpha;            // Alpha
      }
    }

    // create a canvas the same size as the source canvas
    const destinationCanvas = document.createElement('canvas');
    destinationCanvas.width  = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    const destinationCtx = destinationCanvas.getContext('2d');

    // copy the thresholded image data to the threshold canvas
    destinationCtx.putImageData(destinationData, 0, 0);

    // return the thresholded canvas
    return destinationCanvas;
  }

  renderToCanvas(engraveCtx)
  {
    logMessage('debug', `renderToCanvas(): dithering: ${this.m_dithering}, invert: ${this.m_invertImage}`);

    // load the raw image data into a new ImageData object
    const loadedImageData = new ImageData(this.m_data, this.m_width, this.m_height);

    // create a canvas the same size as the ImageData image
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width  = this.m_width;
    sourceCanvas.height = this.m_height;
    const sourceCtx = sourceCanvas.getContext('2d');

    // put the image data into the source canvas
    sourceCtx.putImageData(loadedImageData, 0, 0);

    // scale the image
    const scaleCanvas  = this.applyScale(sourceCanvas);

    // rotate the image
    const rotateCanvas = this.applyRotation(scaleCanvas);

    // Apply threshold to the image
    const transformCanvas = this.applyThreshold(rotateCanvas);
    if (!transformCanvas) {
      logMessage('warn', 'Threshold application failed, using rotated canvas');
      transformCanvas = rotateCanvas;
    }

    // Draw the image onto the engrave canvas
    engraveCtx.drawImage(
      transformCanvas,
      0, 0, transformCanvas.width, transformCanvas.height,
      this.m_imageOffsetX, this.m_imageOffsetY, transformCanvas.width, transformCanvas.height
    );
  }

  adjustOffsetAfterRotation(engraveWidth, engraveHeight)
  {
    // calculate the scaled width and height
    const scaledWidth  = Math.round(this.m_width * this.m_imageScale);
    const scaledHeight = Math.round(this.m_height * this.m_imageScale);
  
    //logMessage('debug', `scaled width: ${scaledWidth}, scaled height: ${scaledHeight}`);
  
    // calculate the rotated width
    const rotatedWidth  = Math.round(Math.abs(scaledWidth * Math.cos(degreesToRadians(this.m_rotateAngle))) + Math.abs(scaledHeight * Math.sin(degreesToRadians(this.m_rotateAngle))));
    const rotatedHeight = Math.round(Math.abs(scaledWidth * Math.sin(degreesToRadians(this.m_rotateAngle))) + Math.abs(scaledHeight * Math.cos(degreesToRadians(this.m_rotateAngle))));
  
    //logMessage('debug', `angle: ${this.m_rotateAngle}, rotated width: ${rotatedWidth}, rotated height: ${rotatedHeight}`);
  
    // calculate the offset to center the image on the engrave buffer
    this.m_imageOffsetX = Math.round((engraveWidth - rotatedWidth) / 2);
    this.m_imageOffsetY = Math.round((engraveHeight - rotatedHeight) / 2);
  
    //logMessage('debug', `adjusted offset: ${this.m_imageOffsetX}, ${this.m_imageOffsetY}`);
  }

  onScaleChange(value)
  {
    this.m_imageScale = this.m_maxImageScale * value / 100;
    this.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
} // ImageBuffer

