
const Protocol = require('./protocol');
const { logToWindow } = require('./log');

const { SerialPort } = require('serialport');

class K3Laser extends Protocol {

    static getDeviceName() {
        return 'K3 Laser';
    }

    constructor() {
      super();
    }

    // Initialize the protocol handler
    async init(port) {
      this.port = port;
      this.buffer = Buffer.alloc(0);
      this.callbacks = new Map();
      this.responsePromise = null;
      this.responseResolve = null;
      this.responseTimeout = null;

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

        // send command and wait for ack
        const ack = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.CONNECT), TIMEOUTS.CONNECT);
        if (!ack) {
            logToWindow('error', 'Failed to send connect command');
            return { 
              status: 'error', 
              message: 'Failed to send connect command' 
            };
        }

        // Send fan off and wait for ack
        const fanAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.FAN_OFF), TIMEOUTS.FAN);
        if (!fanAck) {
            logToWindow('error', 'Failed to send fan off command');
            return {
                status: 'error',
                message: 'Failed to send fan off command'
            };
        }

        // Send home command and wait for ack
        const homeAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.HOME), TIMEOUTS.HOME);
        if (!homeAck) {
            logToWindow('error', 'Failed to send home command');
            return {
              status: 'error',
              message: 'Failed to send home command'
            };
            return;
        }

        return {
            status: 'success',
            message: 'Connected to K3 Laser'
        };
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

    async sendFanOn() {
      const ack = await this.sendMessageAndWaitForAck(Buffer.from(COMMANDS.FAN_ON), TIMEOUTS.FAN);
      if (!ack) {
        logToWindow('error', 'Failed to send fan on command');
        return false;
      }

      return true;  
    }

    async sendFanOff() {
      const ack = await this.sendMessageAndWaitForAck(Buffer.from(COMMANDS.FAN_OFF), TIMEOUTS.FAN);
      if (!ack) {
        logToWindow('error', 'Failed to send fan off command');
        return false;
      }

      return true;  
    }

    async sendCenter() {
      const ack = await this.sendMessageAndWaitForAck(Buffer.from(COMMANDS.CENTER), TIMEOUTS.CENTER);
      if (!ack) {
        logToWindow('error', 'Failed to send center command');
        return false;
      }

      return true;  
    }

    // send home command and wait for ack
    async sendHome() {
      const ack = await this.sendMessageAndWaitForAck(Buffer.from(COMMANDS.HOME), TIMEOUTS.HOME);
      if (!ack) {
        logToWindow('error', 'Failed to send home command');
        return false;
      }

      return true;  
    }

    // send move command and wait for ack
    async sendMove(command) {
      const moveAck = await this.sendMessageAndWaitForAck(Buffer.from(command), TIMEOUTS.MOVE);
      if (!moveAck) {
        logToWindow('error', 'Failed to send move command');
        return false;
      }

      return true;
    }

    // Add function to send line data to the engraver
    async sendLineData(lineData, lineNumber) {
      if (!this.port || !this.port.isOpen) {
        throw new Error('Serial port is not open');
      }
      
      // Convert lineData to binary format expected by engraver
      // This is a simplified example - adjust to match your engraver's protocol
      const dataBuffer = Buffer.from(lineData);

      // see if line is all 0s
      const isAllZeros = lineData.every(value => value === 0);

      // if line is all 0s, nothing to send
      if (isAllZeros) {
        resolve();
      }

/*
      const packetHeader = Buffer.from([0xA5, 0x5A]); // Example header
      const lineNumberBuffer = Buffer.alloc(2);
      lineNumberBuffer.writeUInt16LE(lineNumber, 0);
      
      
      // Construct the complete packet
      const packet = Buffer.concat([
        packetHeader,
        lineNumberBuffer,
        dataBuffer
      ]);
      
      // Send the packet to the engraver
      return new Promise((resolve, reject) => {
        this.port.write(packet, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Wait for acknowledgment if needed
          // You may need to implement this based on your protocol
          
          resolve();
        });
      });
    */
  }
}

module.exports = K3Laser; 