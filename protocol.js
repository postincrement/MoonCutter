const { SerialPort } = require('serialport');

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
    init() {
        this.port.on('data', (data) => {
            this.buffer = Buffer.concat([this.buffer, data]);
            this.processBuffer();
        });

        this.port.on('error', (error) => {
            console.error('Protocol error:', error);
            if (this.responseResolve) {
                this.responseResolve({ error: error.message });
                this.clearResponseHandlers();
            }
        });
    }

    // Process incoming data buffer
    processBuffer() {
        // If we have data and are waiting for a response
        if (this.responseResolve && this.buffer.length > 0) {
            // Create a copy of the current buffer
            const response = Buffer.from(this.buffer);
            // Clear the buffer
            this.buffer = Buffer.alloc(0);
            // Resolve with the response
            this.responseResolve({ data: response });
            this.clearResponseHandlers();
        }
    }

    // Clear response handlers
    clearResponseHandlers() {
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
        this.responseResolve = null;
        this.responsePromise = null;
    }

    // Send a message of any length and wait for a reply
    async sendMessageAndWaitForReply(message, timeout = null) {
        if (!this.port.isOpen) {
            throw new Error('Port is not open');
        }

        return new Promise((resolve, reject) => {
            // Set up response timeout if specified
            if (timeout !== null) {
                this.responseTimeout = setTimeout(() => {
                    this.clearResponseHandlers();
                    resolve({ error: `Response timeout after ${timeout}ms` });
                }, timeout);
            }

            // Store resolve function for when we get the response
            this.responseResolve = resolve;

            // Send the message
            this.port.write(message, (err) => {
                if (err) {
                    this.clearResponseHandlers();
                    resolve({ error: err.message });
                }
            });
        });
    }
}

module.exports = Protocol; 