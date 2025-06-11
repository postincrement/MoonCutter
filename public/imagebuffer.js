// ImageBuffer class

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

class ImageBuffer 
{
  constructor(width, height, isText) {
    this.m_default = false;
    this.m_width   = width;
    this.m_height  = height;
    this.m_data    = new Uint8ClampedArray(width * height * 4);

    this.m_isText = isText;

    this.m_maxImageScale = 1.0;

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

  // set the default scale for the image
  setDefaultScale(settings, engraveWidth, engraveHeight) 
  {
    //logMessage('debug', `setDefaultScale(): engrave buffer size: ${engraveWidth}x${engraveHeight}`);
    
    // Calculate scaling to fit image into engraving buffer while maintaining aspect ratio and zero rotation
    settings.m_rotateAngle = 0;
    settings.m_imageScale = 1.0;
    if (this.m_width > this.m_height) {
      this.m_maxImageScale = engraveWidth / this.m_width;
      settings.m_imageOffsetX = 0;
      settings.m_imageOffsetY = (engraveHeight - this.m_height * this.m_maxImageScale) / 2;
    }
    else {
      this.m_maxImageScale = engraveHeight / this.m_height;
      settings.m_imageOffsetX = (engraveWidth - this.m_width * this.m_maxImageScale) / 2;
      settings.m_imageOffsetY = 0;
    }
    return settings;
  }

  // apply scale to the source canvas
  applyScale(settings, sourceCanvas)
  {
    const scale = this.m_maxImageScale * settings.m_imageScale;

    logMessage('debug', `maxImageScale: ${this.m_maxImageScale}, imageScale: ${settings.m_imageScale}`);

    // create a canvas the same size as the scaled image
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width  = sourceCanvas.width * scale;
    scaledCanvas.height = sourceCanvas.height * scale;
    const scaledCtx = scaledCanvas.getContext('2d');
  
    // scale image to the scaled canvas
    scaledCtx.save();
    scaledCtx.translate(scaledCanvas.width / 2, scaledCanvas.height / 2);
    scaledCtx.scale(scale, scale);
    scaledCtx.translate(-sourceCanvas.width / 2, -sourceCanvas.height / 2);
    scaledCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    scaledCtx.restore();
  
    logMessage('debug', `scaled canvas size: ${scaledCanvas.width}x${scaledCanvas.height}`);
  
    // get the transformed image data
    return scaledCanvas;
  }
  
  // apply rotation to the source canvas
  applyRotation(settings, sourceCanvas) 
  {
    const radians = degreesToRadians(settings.m_rotateAngle);

    logMessage('debug', `applying rotation: ${settings.m_rotateAngle} degrees (${radians} radians) to ${sourceCanvas.width}x${sourceCanvas.height}`);
  
    // calculate size of rotated image
    const rotatedWidth  = Math.round(Math.abs(sourceCanvas.width * Math.cos(radians)) + Math.abs(sourceCanvas.height * Math.sin(radians)));
    const rotatedHeight = Math.round(Math.abs(sourceCanvas.width * Math.sin(radians)) + Math.abs(sourceCanvas.height * Math.cos(radians)));
  
    logMessage('debug', `rotated by ${settings.m_rotateAngle} degrees: ${rotatedWidth}x${rotatedHeight}`);
  
    // Create a temporary canvas for the destination image
    const rotatedCanvas = document.createElement('canvas');
    const rotatedCtx = rotatedCanvas.getContext('2d');
    rotatedCanvas.width  = rotatedWidth;
    rotatedCanvas.height = rotatedHeight;
  
    logMessage('debug', `rotated canvas size: ${rotatedWidth}x${rotatedCanvas.height}`);
  
    // draw the source canvas onto the destination canvas with rotation
    rotatedCtx.save();
    rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedCtx.rotate(radians);
    rotatedCtx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    rotatedCtx.restore();
  
    return rotatedCanvas;
  }  

  // render the image to the engrave canvas with scaling and rotation
  renderToCanvas(settings, engraveCtx)
  {
    logMessage('debug', `rendering image to canvas: ${this.m_width}x${this.m_height}`);

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
    const scaleCanvas  = this.applyScale(settings, sourceCanvas);

    // rotate the image
    const rotateCanvas = this.applyRotation(settings, scaleCanvas);

    const rotateCtx = rotateCanvas.getContext('2d');

    if (settings.m_text) {
      if (settings.m_mode == 'invert') {
        logMessage('debug', `inverting image`);
        rotateCtx.globalCompositeOperation='difference';
        rotateCtx.fillStyle='white';
        rotateCtx.fillRect(0,0,rotateCanvas.width,rotateCanvas.height);
      }
      else if (settings.m_mode == 'keyhole') {
        logMessage('debug', `keyholing image`);
        rotateCtx.globalCompositeOperation='destination-out';
      }
    }
    else if (settings.m_invert) {
      logMessage('debug', `inverting image`);
      rotateCtx.globalCompositeOperation='difference';
      rotateCtx.fillStyle='white';
      rotateCtx.fillRect(0,0,rotateCanvas.width,rotateCanvas.height);
    }

    // Draw the image onto the engrave canvas
    engraveCtx.drawImage(
      rotateCanvas,
      0, 0, rotateCanvas.width, rotateCanvas.height,
      settings.m_imageOffsetX, settings.m_imageOffsetY, rotateCanvas.width, rotateCanvas.height
    );
  }

  adjustOffsetAfterRotation(settings, engraveWidth, engraveHeight)
  {
    // calculate the scaled width and height
    const scaledWidth  = Math.round(this.m_width * settings.m_imageScale / 100.0);
    const scaledHeight = Math.round(this.m_height * settings.m_imageScale / 100.0);
  
    logMessage('debug', `scaled width: ${scaledWidth}, scaled height: ${scaledHeight}`);
  
    // calculate the rotated width
    const rotatedWidth  = Math.round(Math.abs(scaledWidth * Math.cos(degreesToRadians(settings.m_rotateAngle))) + Math.abs(scaledHeight * Math.sin(degreesToRadians(settings.m_rotateAngle))));
    const rotatedHeight = Math.round(Math.abs(scaledWidth * Math.sin(degreesToRadians(settings.m_rotateAngle))) + Math.abs(scaledHeight * Math.cos(degreesToRadians(settings.m_rotateAngle))));
  
    logMessage('debug', `angle: ${settings.m_rotateAngle}, rotated width: ${rotatedWidth}, rotated height: ${rotatedHeight}`);
  
    // calculate the offset to center the image on the engrave buffer
    settings.m_imageOffsetX = Math.round((engraveWidth - rotatedWidth) / 2);
    settings.m_imageOffsetY = Math.round((engraveHeight - rotatedHeight) / 2);
  
    logMessage('debug', `adjusted offset: ${settings.m_imageOffsetX}, ${settings.m_imageOffsetY}`);

    return settings;
  }
} // ImageBuffer

