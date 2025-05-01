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

    constructor() {
    }
    
    // Initialize the protocol handler
    init(port) 
    {
      return {
        status: 'connected'
      };
    }

    sendFanOn() 
    {
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    sendFanOff() 
    {
      return {
        status: 'error',
        message: 'not implemented'
      };
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