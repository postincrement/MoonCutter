const { SerialPort } = require('serialport');
const { logToWindow } = require('./log');

const ACK = 9;


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

          // get the oldest character from the buffer
          const oldestChar = this.buffer[0];

          // remove the oldest character from the buffer
          this.buffer = this.buffer.slice(1);

          // return the oldest character
          this.responseResolve({ data: oldestChar });

          // clear the response handlers
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

    // send a message and wait for an ack
    async sendMessageAndWaitForAck(message, timeout = null) {
      logToWindow('info', 'Sending message:', message);

      const response = await this.sendMessageAndWaitForReply(message, timeout);
      if (response.error) {
        logToWindow('error', 'Error sending message:', response.error);
          return false;
      }

      if (response.data === ACK) {
        logToWindow('info', 'received ACK');
        return true;
      }

      // if the response is not an ack, return false
      logToWindow('error', 'Received unexpected response:', response.data);
      return false;
    }

}

module.exports = Protocol; 