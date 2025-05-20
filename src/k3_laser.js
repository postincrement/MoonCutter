
const Protocol = require('./protocol');
const { logMessage } = require('./log');

const { SerialPort } = require('serialport');

let BED_WIDTH_PIXELS  = 1600;  // size of the bed in pixels
let BED_HEIGHT_PIXELS = 1520;  

let BED_WIDTH_MM  = 80;  // size of the bed in mm
let BED_HEIGHT_MM = 76;  


// if true, clamp movements to the bed size
const g_clampMovements = false;

// the size of a movement nudge
const g_nudgeSize = 100;

// Command constants
const COMMANDS = {
  CONNECT: [10, 0, 4, 0],
  HOME:    [23, 0, 4, 0],
  CENTER:  [26, 0, 4, 0],
  FAN_ON:  [ 4, 0, 4, 0],
  FAN_OFF: [ 5, 0, 4, 0],
                         //xmsb  xlsb  ymsb  ylsb
  MOVE:    [ 1, 0, 7,       0,    0,     0,    0]
};

// Timeout constants (in milliseconds)
const TIMEOUTS = {
  CONNECT: 100,
  FAN: 100,
  HOME: 6000,
  CENTER: 6000,
  MOVE: 500
};

const ACK = 0x09;

class K3Laser extends Protocol {

    static getDeviceName() {
        return 'K3 Laser';
    }

    constructor() {
      super(BED_WIDTH_PIXELS, BED_HEIGHT_PIXELS, BED_WIDTH_MM, BED_HEIGHT_MM);
    }

    // Initialize the protocol handler
    async init(port) {
      super.init(port);
      this.buffer = Buffer.alloc(0);
      this.callbacks = new Map();
      this.responsePromise = null;
      this.responseResolve = null;
      this.responseTimeout = null;

      this.m_laserX = 0;
      this.m_laserY = 0;

      this.m_port.on('data', (data) => {
            this.buffer = Buffer.concat([this.buffer, data]);
            this.processBuffer();
        });

      this.m_port.on('error', (error) => {
          console.error('Protocol error:', error);
          if (this.responseResolve) {
              this.responseResolve({ error: error.message });
              this.clearResponseHandlers();
          }
      });

        // send connect command and wait for ack
        const ack = await this.sendMessageAndWaitForAck("connect", Buffer.from(COMMANDS.CONNECT), TIMEOUTS.CONNECT);
        if (!ack) {
            logMessage('error', 'Failed to send connect command');
            return { 
              status: 'error', 
              message: 'Failed to send connect command' 
            };
        }

        // Send fan off and wait for ack
        const fanAck = await this.setFan(false);
        if (!fanAck) {
            logMessage('error', 'Failed to send fan off command');
            return {
                status: 'error',
                message: 'Failed to send fan off command'
            };
        }

        // Send home command and wait for ack
        const homeAck = await this.sendHome();
        if (!homeAck) {
            logMessage('error', 'Failed to send home command');
            return {
              status: 'error',
              message: 'Failed to send home command'
            };
        }
        this.m_laserX = 0;
        this.m_laserY = 0;

        return {
            status: 'connected',
            xSize: BED_WIDTH_MM,
            ySize: BED_HEIGHT_MM
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
        if (!this.m_port.isOpen) {
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
            this.m_port.write(message, (err) => {
                if (err) {
                    this.clearResponseHandlers();
                    resolve({ error: err.message });
                }
            });
        });
    }

    // send a message and wait for an ack
    async sendMessageAndWaitForAck(name, message, timeout = null) {
      logMessage('info', 'Sending ' + name + ' message:', message);

      const response = await this.sendMessageAndWaitForReply(message, timeout);
      if (response.error) {
        logMessage('error', 'Error sending message:', response.error);
          return false;
      }

      if (response.data === ACK) {
        logMessage('info', 'received ACK');
        return true;
      }

      // if the response is not an ack, return false
      logMessage('error', 'Received unexpected response:', response.data);
      return false;
    }

    async setFan(fanOn) {
      super.setFan(fanOn);
      const command = this.m_fanOn ? COMMANDS.FAN_ON : COMMANDS.FAN_OFF;
      const ack = await this.sendMessageAndWaitForAck("fan on", Buffer.from(command), TIMEOUTS.FAN);
      if (!ack) {
        logMessage('error', 'Failed to send fan on command');
        return false;
      }

      return true;  
    }

    async sendCenter() {
      this.m_laserX = BED_WIDTH_PIXELS / 2;
      this.m_laserY = BED_HEIGHT_PIXELS / 2;

      const ack = await this.sendMessageAndWaitForAck("center", Buffer.from(COMMANDS.CENTER), TIMEOUTS.CENTER);
      if (!ack) {
        logMessage('error', 'Failed to send center command');
        return false;
      }

      return true;  
    }

    // send home command and wait for ack
    async sendHome() {
      this.m_laserX = 0;
      this.m_laserY = 0;

      const ack = await this.sendMessageAndWaitForAck("home", Buffer.from(COMMANDS.HOME), TIMEOUTS.HOME);
      if (!ack) {
        logMessage('error', 'Failed to send home command');
        return false;
      }

      return true;  
    }

    // send move command and wait for ack
    async sendRelativeMove(directionData) {

      // update the x coordinate
      this.m_laserX += directionData.dx;
      this.m_laserY += directionData.dy;

      // calculate the timeout based on the distance. 
      const distance = Math.sqrt(Math.pow(directionData.dx, 2) + Math.pow(directionData.dy, 2));
      const timeout = Math.max(100 + distance * (10000 / 1600), 1000);

      logMessage('info', `Sending move dx=${directionData.dx} dy=${directionData.dy} with timeout: ${timeout}`);

      if (g_clampMovements) {

        if (this.m_laserX < 0) {
          this.m_laserX = 0;
        }
        else if (this.m_laserX > BED_WIDTH) {
          this.m_laserX = BED_WIDTH;
        }
        directionData.dx = this.m_laserX - currentX;

        // update the y coordinate
        if (this.m_laserY < 0) {
          this.m_laserY = 0;
        }
        else if (this.m_laserY > BED_HEIGHT) {
          this.m_laserY = BED_HEIGHT;
        }
        directionData.dy = this.m_laserY - currentY;
      }
      
      // create the command
      const command = COMMANDS.MOVE;
      command[3] = (directionData.dx >> 8) & 0xFF;
      command[4] = directionData.dx & 0xFF;
      command[5] = (directionData.dy >> 8) & 0xFF;
      command[6] = directionData.dy & 0xFF;

      const moveAck = await this.sendMessageAndWaitForAck("move", Buffer.from(command), timeout);
      if (!moveAck) {
        logMessage('error', 'Failed to send move command');
        return false;
      }

      return true;
    }

    async sendAbsoluteMove(command) {
      const relativeCommand = {
        dx: command.x - this.m_laserX,
        dy: command.y - this.m_laserY
      };
      return this.sendRelativeMove(relativeCommand);
    }

    // Add function to send line data to the engraver
    async sendLineData(lineData, lineNumber) {
      if (!this.m_port || !this.m_port.isOpen) {
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