
const Protocol = require('./protocol');
const { logMessage } = require('./log');

const { SerialPort } = require('serialport');

class GCodeLaser extends Protocol {

    static getDeviceName() {
        return 'GCode';
    }

    constructor() {
        super();
    }

}

module.exports = GCodeLaser;  
