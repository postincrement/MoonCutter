
const Protocol = require('./protocol');
const { logToWindow } = require('./log');

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
