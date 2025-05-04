const { logToWindow } = require('./log');

class Protocol {

    static getDeviceName() {
        return 'Protocol';
    }

    static getNudgeSize() {
        return 1;
    }

    static needsSerialPort() {
        return true;
    }

    static getNudgeSize() {
        return 1;
    }

    constructor(bedWidthPixels, bedHeightPixels, bedWidthMm, bedHeightMm) {
      this.m_bedWidthPixels = bedWidthPixels;
      this.m_bedHeightPixels = bedHeightPixels;
      this.m_bedWidthMm = bedWidthMm;
      this.m_bedHeightMm = bedHeightMm;
      this.m_fanOn = false;
      this.m_port = null;
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
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendHome() 
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