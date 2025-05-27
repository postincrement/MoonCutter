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
    
    this.clear();
  }

  clear() 
  {
    this.m_data.fill(0); // Fill with transparent black
  }

  setDefaultScale(engraveWidth, engraveHeight) 
  {
    logMessage('info', `setDefaultScale(): engrave buffer size: ${engraveWidth}x${engraveHeight}`);
    
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
  
    logMessage('info', `scaled canvas size: ${scaledCanvas.width}x${scaledCanvas.height}`);
  
    // get the transformed image data
    return scaledCanvas;
  }
  
  applyRotation(sourceCanvas) 
  {
    const radians = degreesToRadians(this.m_rotateAngle);
  
    // calculate size of rotated image
    const rotatedWidth  = Math.round(Math.abs(sourceCanvas.width * Math.cos(radians)) + Math.abs(sourceCanvas.height * Math.sin(radians)));
    const rotatedHeight = Math.round(Math.abs(sourceCanvas.width * Math.sin(radians)) + Math.abs(sourceCanvas.height * Math.cos(radians)));
  
    logMessage('info', `rotated by ${this.m_rotateAngle} degrees: ${rotatedWidth}x${rotatedHeight}`);
  
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

  // Add threshold processing function
  applyThreshold(sourceCanvas) {

    // create a canvas the same size as the source canvas
    const thresholdCanvas = document.createElement('canvas');
    thresholdCanvas.width  = sourceCanvas.width;
    thresholdCanvas.height = sourceCanvas.height;
    const thresholdCtx = thresholdCanvas.getContext('2d');

    // get the image data from the source canvas
    const imageData = sourceCanvas.getContext('2d').getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);  

    // get the image data from the threshold canvas
    const thresholdImageData = thresholdCtx.getImageData(0, 0, thresholdCanvas.width, thresholdCanvas.height);

    // copy the image data to the threshold canvas
    thresholdImageData.data.set(imageData.data);  

    // apply the threshold to the threshold canvas
    for (let i = 0; i < thresholdImageData.data.length; i += 4) {
      const grayValue = Math.round(
        0.299 * thresholdImageData.data[i] +      // Red
        0.587 * thresholdImageData.data[i + 1] +  // Green
        0.114 * thresholdImageData.data[i + 2]    // Blue
      );  

      const thresholdedValue = grayValue <= this.m_threshold ? 0 : 255;

      thresholdImageData.data[i] = thresholdedValue;     // Red
      thresholdImageData.data[i + 1] = thresholdedValue; // Green
      thresholdImageData.data[i + 2] = thresholdedValue; // Blue  
    }

    // copy the thresholded image data to the threshold canvas
    thresholdCtx.putImageData(thresholdImageData, 0, 0);

    // return the thresholded canvas
    return thresholdCanvas;
  }

  renderToCanvas(engraveCtx)
  {
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
  
    logMessage('info', `--------------------------------`);
  
    logMessage('info', `scaled width: ${scaledWidth}, scaled height: ${scaledHeight}`);
  
    // calculate the rotated width
    const rotatedWidth  = Math.round(Math.abs(scaledWidth * Math.cos(degreesToRadians(this.m_rotateAngle))) + Math.abs(scaledHeight * Math.sin(degreesToRadians(this.m_rotateAngle))));
    const rotatedHeight = Math.round(Math.abs(scaledWidth * Math.sin(degreesToRadians(this.m_rotateAngle))) + Math.abs(scaledHeight * Math.cos(degreesToRadians(this.m_rotateAngle))));
  
    logMessage('info', `angle: ${this.m_rotateAngle}, rotated width: ${rotatedWidth}, rotated height: ${rotatedHeight}`);
  
    // calculate the offset to center the image on the engrave buffer
    this.m_imageOffsetX = Math.round((engraveWidth - rotatedWidth) / 2);
    this.m_imageOffsetY = Math.round((engraveHeight - rotatedHeight) / 2);
  
    logMessage('info', `adjusted offset: ${this.m_imageOffsetX}, ${this.m_imageOffsetY}`);
  
    logMessage('info', `--------------------------------`);
  }

  onScaleChange(value)
  {
    this.m_imageScale = this.m_maxImageScale * value / 100;
    this.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
} // ImageBuffer

