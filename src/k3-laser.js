const Protocol = require('./protocol');
const { logMessage } = require('./log');

const { SerialPort } = require('serialport');

let BED_WIDTH_PIXELS  = 1600;  // size of the bed in pixels
let BED_HEIGHT_PIXELS = 1520;  

let BED_WIDTH_MM  = 80;  // size of the bed in mm
let BED_HEIGHT_MM = 76;  

let MAX_POWER = 1000;


// if true, clamp movements to the bed size
const g_clampMovements = false;

// the size of a movement nudge
const g_nudgeSize = 100;

// Command constants
const COMMANDS = {
  CONNECT:      [10, 0, 4, 0 ],
  HOME:         [23, 0, 4, 0 ],
  CENTER:       [26, 0, 4, 0 ],
  FAN_ON:       [ 4, 0, 4, 0 ],
  FAN_OFF:      [ 5, 0, 4, 0 ],
  RESET:        [ 6, 0, 4, 0 ],
  DISCRETE_ON:  [27, 0, 4, 0 ],
  DISCRETE_OFF: [28, 0, 4, 0 ],
  STOP:         [22, 0, 4, 0 ],

                         //xmsb  xlsb  ymsb  ylsb
  MOVE:    [  1, 0, 7,      0,    0,    0,    0],
  START:   [ 20, 0, 7,      0,    0,    0,    0],

              //  linelen  depth   power   Y offset
  ENGRAVE: [ 9,   0, 0,    0, 0,   0, 0,   0, 0]
};

/*
        //SET CONFIGRATION SEEE README.md
        img_line_buffer[0] = (BYTE)9;
        img_line_buffer[1] = (BYTE) (ilbsize >> 8);
        img_line_buffer[2] = (BYTE) (ilbsize);
        img_line_buffer[3] = (BYTE) (_engraving_depth_intensity >> 8);
        img_line_buffer[4] = (BYTE) (_engraving_depth_intensity);
        const int laser_intesity_mw = LASER_POWER_MW;//TODO
        img_line_buffer[5] = (BYTE) (laser_intesity_mw >> 8);
        img_line_buffer[6] = (BYTE) (laser_intesity_mw);
        img_line_buffer[7] = (BYTE) (current_height_progress >> 8);
        img_line_buffer[8] = (BYTE) (current_height_progress);
*/

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
      this.responseTimeout = null;

      this.m_laserX = 0;
      this.m_laserY = 0;

      this.m_port.on('error', (error) => {
          console.error('Protocol error:', error);
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

    // send a message and wait for an ack
    async sendMessageAndWaitForAck(name, message, timeout = null) {
        logMessage('info', 'Sending ' + name + ' message:', message);

        if (!this.m_port.isOpen) {
            logMessage('error', 'Port is not open');
            return false;
        }

        // Clear any pending data
        this.buffer = Buffer.alloc(0);

        return new Promise((resolve) => {
            // Record start time
            const startTime = Date.now();

            // Set up response timeout if specified
            if (timeout !== null) {
                this.responseTimeout = setTimeout(() => {
                    logMessage('error', `Response timeout after ${timeout}ms`);
                    resolve(false);
                }, timeout);
            }

            // Set up one-time data handler
            const dataHandler = (data) => {
                // Remove the handler after first use
                this.m_port.removeListener('data', dataHandler);
                
                // Clear timeout
                if (this.responseTimeout) {
                    clearTimeout(this.responseTimeout);
                    this.responseTimeout = null;
                }

                // Calculate elapsed time
                const elapsedTime = Date.now() - startTime;

                // Check for ACK
                if (data[0] === ACK) {
                    logMessage('info', `Received ACK after ${elapsedTime}ms`);
                    resolve(true);
                } else {
                    logMessage('error', `Received unexpected response after ${elapsedTime}ms:`, data[0]);
                    resolve(false);
                }
            };

            // Add the data handler
            this.m_port.once('data', dataHandler);

            // Send the message
            this.m_port.write(message, (err) => {
                if (err) {
                    logMessage('error', 'Error writing to port:', err.message);
                    this.m_port.removeListener('data', dataHandler);
                    if (this.responseTimeout) {
                        clearTimeout(this.responseTimeout);
                        this.responseTimeout = null;
                    }
                    resolve(false);
                }
            });
        });
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
    async sendRelativeMove(directionData) 
    {

      logMessage('info', `Sending relative move dx=${directionData.dx} dy=${directionData.dy}`);

      if (directionData.dx == 0 && directionData.dy == 0) {
        logMessage('info', `Move is zero, skipping`);
        return true;
      }

      // update the x coordinate
      this.m_laserX += directionData.dx;
      this.m_laserY += directionData.dy;

      // calculate the timeout based on the distance. 
      const distance = Math.sqrt(Math.pow(directionData.dx, 2) + Math.pow(directionData.dy, 2));
      const timeout = Math.max(100, (distance * (distance < 100 ? 1 : 2)));

      logMessage('info', `Distance: ${distance} -> ${timeout}ms`);

      // start timer
      const now = Date.now();

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
      var command = COMMANDS.MOVE;
      command[3] = (directionData.dx >> 8) & 0xFF;
      command[4] = directionData.dx & 0xFF;
      command[5] = (directionData.dy >> 8) & 0xFF;
      command[6] = directionData.dy & 0xFF;

      const moveAck = await this.sendMessageAndWaitForAck("move", Buffer.from(command), timeout);
      if (!moveAck) {
        logMessage('error', 'Failed to send move command');
        return false;
      }

      const elapsedTime = Date.now() - now;
      logMessage('info', `Move took ${elapsedTime}ms`);

      const delay = 100;
      logMessage('info', `Delaying for ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));

      return true;
    }

    async sendAbsoluteMove(command) {
      logMessage('info', `Sending absolute move to ${command.x}, ${command.y}`);
      const relativeCommand = {
        dx: command.x - this.m_laserX,
        dy: command.y - this.m_laserY
      };
      return this.sendRelativeMove(relativeCommand);
    }

    async startEngraving(info) {

      // set discrete mode
      const discreteCommand = COMMANDS.DISCRETE_OFF;
      const discreteAck = await this.sendMessageAndWaitForAck("discrete", Buffer.from(discreteCommand), TIMEOUTS.DISCRETE);
      if (!discreteAck) {
        logMessage('error', 'Failed to send discrete command');
        return false;
      }

      // set reset command
      const resetCommand = COMMANDS.RESET;
      const resetAck = await this.sendMessageAndWaitForAck("reset", Buffer.from(resetCommand), TIMEOUTS.RESET);
      if (!resetAck) {
        logMessage('error', 'Failed to send reset command');
        return false;
      }

      this.m_speed = info.speed;
      this.m_power = info.power;

      // turn on the fan
      await this.setFan(true);


      // get the size of the image
      const x = info.boundingBox.left;
      const y = info.boundingBox.top;

      var command = COMMANDS.START;
      command[3] = (x >> 8) & 0xFF;
      command[4] = x & 0xFF;
      command[5] = (y >> 8) & 0xFF;
      command[6] = y & 0xFF;

      this.m_startX = x;
      this.m_startY = y;

      const ack = await this.sendMessageAndWaitForAck("start", Buffer.from(command), TIMEOUTS.START);
      if (!ack) {
        logMessage('error', 'Failed to send start command');
        return false;
      }

      // sleep for 500ms
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    }

    // Add function to send line data to the engraver
    async engraveLine(lineData, lineNumber) {
      
      // set the laser position to the start position + the line number
      this.m_laserY = this.m_startY + lineNumber;
      this.m_laserX = this.m_startX;

      // allocate buffer for command
      const commandLength = COMMANDS.ENGRAVE.length + (lineData.length + 7) / 8;
      var commandBuffer   = Buffer.alloc(commandLength);

      commandBuffer[0] = COMMANDS.ENGRAVE[0];

      // command length
      commandBuffer[1] = commandLength >> 8;
      commandBuffer[2] = commandLength & 0xFF;

      // speed of laser
      var speed = 1;
      if (this.m_speed >= 25) {
        speed = Math.round(51 - this.m_speed);  
      }
      else {
        speed = Math.round(29 + ((24 - this.m_speed) * 3))  
      }
      logMessage('info', `Speed: ${this.m_speed} -> ${speed}`);
      commandBuffer[3] = speed >> 8;
      commandBuffer[4] = speed & 0xFF;

      // laser power
      var power = Math.min(this.m_power*10, MAX_POWER);
      logMessage('info', `Power: ${this.m_power} -> ${power}`);
      commandBuffer[5] = power >> 8;
      commandBuffer[6] = power & 0xFF;

      // current height progress
      commandBuffer[7] = lineNumber >> 8;
      commandBuffer[8] = lineNumber & 0xFF;

      // each engrave line is packed into bytes
      // each bit is a pixel
      // the least significant bit is the pixel at the bottom left
      // the most significant bit is the pixel at the top right
      // the data is packed into bytes from left to right, bottom to top
      var pixelPtr = COMMANDS.ENGRAVE.length;

      var byte = 0;
      for (let i = 0; i < lineData.length; i++) {
        byte = byte << 1;
        if (lineData[i] < 0x80) {
          byte |= 1;
        }
        if (i % 8 == 7) {
          commandBuffer[pixelPtr] = byte;
          pixelPtr++;
          byte = 0;
        }
      }
      commandBuffer[pixelPtr] = byte;

      const startTime = Date.now();

      // send the line data to the engraver
      const ack = await this.sendMessageAndWaitForAck("engrave line", commandBuffer, TIMEOUTS.ENGRAVE);
      if (!ack) {
        logMessage('error', 'Failed to send engrave line command');
        return false;
      }

      // find rightmost non-zero pixel
      var rightmostNonZeroPixel = lineData.length;
      while (rightmostNonZeroPixel > 1 && lineData[rightmostNonZeroPixel-1] >= 0x80) {
        rightmostNonZeroPixel--;
      }

      const elapsedTime = Date.now() - startTime;
      const pixelsPerSecond = (rightmostNonZeroPixel / elapsedTime) * 1000;
      logMessage('info', `Engrave line ${lineNumber} took ${elapsedTime}ms = ${pixelsPerSecond} pixels/sec for ${rightmostNonZeroPixel} pixels`);

      return true;
    }

    async stopEngraving() 
    {
      // set the laser position to the start position + the line number
      this.m_laserY = this.m_startY;
      this.m_laserX = this.m_startX;

      // send stop command
      const stopCommand = COMMANDS.STOP;
      const stopAck = await this.sendMessageAndWaitForAck("stop", Buffer.from(stopCommand), TIMEOUTS.STOP);
      if (!stopAck) {
        logMessage('error', 'Failed to send stop command');
        return false;
      }

      // turn off the fan
      await this.setFan(false);

      return true;
    }
}

module.exports = K3Laser; 