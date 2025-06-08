
const { logMessage } = require('./log');

const K3Laser = require('./protocol');

let BED_WIDTH_PIXELS  = 1024;  // size of the bed in pixels
let BED_HEIGHT_PIXELS = 768;  

let BED_WIDTH_MM  = 100;  // size of the bed in mm
let BED_HEIGHT_MM = 75;  


class TestLaser extends K3Laser {

    static getDeviceName() {
        return 'Test Laser';
    }

    static needsSerialPort()
    {
        return false;
    }

    constructor() {
        super(BED_WIDTH_PIXELS, BED_HEIGHT_PIXELS, BED_WIDTH_MM, BED_HEIGHT_MM);
    }
  
    async init(port) {
        this.m_laserX = 0;
        this.m_laserY = 0;
  
        return {
            status: 'connected',
            xSize: BED_WIDTH_MM,
            ySize: BED_HEIGHT_MM
        };
    }

    async setFan(fanOn) {
        logMessage('info', `setFan(${fanOn})`);
        return true;
    }

    async sendCenter() {
        logMessage('info', `sendCenter()`);
        return true;
    }

    async sendHome() {
        logMessage('info', `sendHome()`);
        return true;
    }

    async sendRelativeMove(directionData) {
        logMessage('info', `sendRelativeMove(${directionData.dx}, ${directionData.dy})`);
        // update the x coordinate
        this.m_laserX += directionData.dx;
        this.m_laserY += directionData.dy;
        return true;
    }

    async startEngraving() {
        logMessage('info', `startEngraving()`);
        return true;
    }

    async engraveLine(lineData, lineNumber) {
        logMessage('info', `engraveLine(lineNumber: ${lineNumber})`);

        // insert delay here
        const delay = 100;
        //logMessage('debug', 'Delaying for', delay, 'ms for line', lineNumber);

        const pixelCount = Math.trunc((lineData.length + 7) / 8);
        var pixelBuffer   = Buffer.alloc(pixelCount);
        var pixelPtr      = 0;

        var byte = 0;
        for (let i = 0; i < lineData.length; i++) {
          byte = byte << 1;
          if (lineData[i] < 0x80) {
            byte |= 1;
          }
          if (i % 8 == 7) {
            pixelBuffer[pixelPtr] = byte;
            pixelPtr++;
            byte = 0;
          }
        }

        logMessage('debug', 'Line data:', pixelBuffer);
        
        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));

        return true;
    }

    async stopEngraving() {
        logMessage('info', `stopEngraving()`);
        return true;
    }
}

module.exports = TestLaser;  
