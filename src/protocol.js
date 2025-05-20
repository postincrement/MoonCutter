const { logMessage } = require('./log');

class Protocol {

    static getDeviceName() {
        return 'Protocol';
    }

    static needsSerialPort() {
        return true;
    }

    constructor(bedWidthPixels, bedHeightPixels, bedWidthMm, bedHeightMm) {
      this.m_bedWidthPixels = bedWidthPixels;
      this.m_bedHeightPixels = bedHeightPixels;
      this.m_bedWidthMm = bedWidthMm;
      this.m_bedHeightMm = bedHeightMm;
      this.m_fanOn = false;
      this.m_port = null;
      this.m_laserX = 0;
      this.m_laserY = 0;
    }

    // Initialize the protocol handler
    init(port) 
    {
      this.m_port = port;
      this.m_fanOn = false;
      return {
        status: 'connected'
      };
    }

    getDimensions() {
      return {
        width: this.m_bedWidthPixels,
        height: this.m_bedHeightPixels,
        widthMm: this.m_bedWidthMm,
        heightMm: this.m_bedHeightMm
      };
    }
    
    setFan(fanOn) 
    {
      this.m_fanOn = fanOn;
      return {
        status: 'success'
      };
    }

    getFan()
    {
      return this.m_fanOn;
    }

    sendCenter() 
    {
      this.m_laserX = this.m_bedWidthPixels / 2;
      this.m_laserY = this.m_bedHeightPixels / 2;
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendHome() 
    {
      this.m_laserX = 0;
      this.m_laserY = 0;
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendAbsoluteMove(command) 
    {
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendRelativeMove(command) 
    {
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendLineData(lineData, lineNumber) 
    {
      return {
        status: 'error',
        message: 'not implemented'
      };
    }
}

module.exports = Protocol; 