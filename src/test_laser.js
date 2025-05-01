
const { logToWindow } = require('./log');

const Protocol = require('./protocol');

class TestLaser extends Protocol {

    static getDeviceName() {
        return 'Test Laser';
    }

    static needsSerialPort()
    {
        return false;
    }

    constructor() {
        super();
    }

    init(port) {
        return { success: true };
    }
}

module.exports = TestLaser;  
