/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Shared constants for MoonCutter
const BORDER = 60;

// Device tab
const g_deviceTypeSelect    = document.getElementById('deviceTypeSelect');
const g_serialPortSelect    = document.getElementById('serialPortSelect');
const g_refreshButton       = document.getElementById('refreshButton');
const g_connectButton       = document.getElementById('connectButton');
const g_connectionIndicator = document.getElementById('connectionIndicator');

// Image tab
const g_loadImageButton        = document.getElementById('loadImageButton');
const g_clearImageButton       = document.getElementById('clearImageButton');
const g_thresholdSlider        = document.getElementById('thresholdSlider');
const g_thresholdInput         = document.getElementById('thresholdInput');
const g_ditherButton           = document.getElementById('ditherButton');
const g_invertImageButton      = document.getElementById('invertImageButton');
const g_scaleSlider            = document.getElementById('scaleSlider');
const g_scaleInput             = document.getElementById('scaleInput');
const g_rotateImageLeftButton  = document.getElementById('rotateImageLeftButton');
const g_rotateImageRightButton = document.getElementById('rotateImageRightButton');
const g_flipImageHorizontalButton = document.getElementById('flipImageHorizontalButton');
const g_flipImageVerticalButton = document.getElementById('flipImageVerticalButton');

// Text tab
const g_textInput             = document.getElementById('textInput');
const g_fontSelect            = document.getElementById('fontSelect');
const g_fontSizeSlider        = document.getElementById('fontSizeSlider');
const g_fontSizeInput         = document.getElementById('fontSizeInput');
const g_boldButton            = document.getElementById('boldButton');
const g_italicButton          = document.getElementById('italicButton');
const g_underlineButton       = document.getElementById('underlineButton');
const g_outlineButton         = document.getElementById('outlineButton');
const g_justifyLeftButton     = document.getElementById('justifyLeftButton');
const g_justifyCenterButton   = document.getElementById('justifyCenterButton');
const g_justifyRightButton    = document.getElementById('justifyRightButton');
const g_normalTextButton      = document.getElementById('normalTextButton');
const g_invertTextButton      = document.getElementById('invertTextButton');
const g_keyholeTextButton     = document.getElementById('keyholeTextButton');
const g_rotateTextLeftButton  = document.getElementById('rotateTextLeftButton');
const g_rotateTextRightButton = document.getElementById('rotateTextRightButton');
const g_flipTextHorizontalButton = document.getElementById('flipTextHorizontalButton');
const g_flipTextVerticalButton = document.getElementById('flipTextVerticalButton');


// Engrave tab
const g_startButton         = document.getElementById('startButton');
const g_stopButton          = document.getElementById('stopButton');
const g_homeButton          = document.getElementById('homeButton');
const g_engraveAreaButton   = document.getElementById('engraveAreaButton');
const g_speedSlider         = document.getElementById('speedSlider');
const g_speedInput          = document.getElementById('speedInput');
const g_powerSlider         = document.getElementById('powerSlider');
const g_powerInput          = document.getElementById('powerInput');
const g_progressFill        = document.querySelector('.progress-fill');
const g_progressText        = document.querySelector('.progress-text');




function logMessage(type, ...items) {
  const formattedMessage = items.map(item => {
    if (typeof item === 'object') {
      try {
        return JSON.stringify(item, null, 2); 
      } catch (e) {
        return String(item);
      }
    }
    return String(item);
  }).join(' ');
  console.log(formattedMessage);
  window.api.logMessage(formattedMessage, type);
}