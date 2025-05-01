const { logToWindow } = require('./log');

class Protocol {

    static needsSerialPort() {
        return true;
    }

    constructor() {
    }
    
    // Initialize the protocol handler
    init(port) 
    {
    }

    sendFanOn() 
    {
    }

    sendFanOff() 
    {
    }

    sendCenter() 
    {
    }

    sendHome() 
    {
    }

    sendMove(command) 
    {
    }

    sendLineData(lineData, lineNumber) 
    {
    }
}

module.exports = Protocol; 