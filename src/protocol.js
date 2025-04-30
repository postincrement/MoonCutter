const { logToWindow } = require('./log');

class Protocol {
    
    constructor(port) {
        this.port = port;
        this.buffer = Buffer.alloc(0);
        this.callbacks = new Map();
        this.responsePromise = null;
        this.responseResolve = null;
        this.responseTimeout = null;
    }

    // Initialize the protocol handler
    init() 
    {
    }
}

module.exports = Protocol; 