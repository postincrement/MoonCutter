const { logMessage } = require('./log');

class Protocol {

    static getDeviceName() {
        return 'Protocol';
    }

    static needsSerialPort() {
        return true;
    }

    constructor(bedWidthPixels, bedHeightPixels, bedWidthMm, bedHeightMm) {
      this.m_bedWidthPixels = bedWidthPixels;
      this.m_bedHeightPixels = bedHeightPixels;
      this.m_bedWidthMm = bedWidthMm;
      this.m_bedHeightMm = bedHeightMm;
      this.m_fanOn = false;
      this.m_port = null;
      this.m_laserX = 0;
      this.m_laserY = 0;
      this.buffer = Buffer.alloc(0);
      this._errorHandler = null;
      this._closeHandler = null;
      this._dataHandler = null;
      this._isCleaningUp = false;
    }

    // Initialize the protocol handler
    async init(port) {
        try {
            if (this._isCleaningUp) {
                throw new Error('Device is being cleaned up');
            }

            this.m_port = port;
            this.m_fanOn = false;
            this.buffer = Buffer.alloc(0);

            // Remove any existing handlers
            this._cleanupEventListeners();

            // Set up port error handler
            this._errorHandler = (error) => {
                if (!this._isCleaningUp) {
                    console.error('Port error:', error);
                    logMessage('error', 'Port error: ' + error.message);
                }
            };
            this.m_port.on('error', this._errorHandler);

            // Set up port close handler
            this._closeHandler = () => {
                if (!this._isCleaningUp) {
                    this._cleanupEventListeners();
                    this.m_port = null;
                    this.buffer = Buffer.alloc(0);
                }
            };
            this.m_port.on('close', this._closeHandler);

            return {
                status: 'connected'
            };
        } catch (error) {
            logMessage('error', 'Error in protocol init: ' + error.message);
            this._cleanupEventListeners();
            throw error;
        }
    }

    _cleanupEventListeners() {
        if (this.m_port) {
            if (this._errorHandler) {
                this.m_port.removeListener('error', this._errorHandler);
                this._errorHandler = null;
            }
            if (this._closeHandler) {
                this.m_port.removeListener('close', this._closeHandler);
                this._closeHandler = null;
            }
            if (this._dataHandler) {
                this.m_port.removeListener('data', this._dataHandler);
                this._dataHandler = null;
            }
        }
    }

    getDimensions() {
      return {
        width: this.m_bedWidthPixels,
        height: this.m_bedHeightPixels,
        widthMm: this.m_bedWidthMm,
        heightMm: this.m_bedHeightMm
      };
    }
    
    async setFan(fanOn) 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      this.m_fanOn = fanOn;
      return {
        status: 'success'
      };
    }

    getFan()
    {
      return this.m_fanOn;
    }

    async sendCenter() 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      this.m_laserX = this.m_bedWidthPixels / 2;
      this.m_laserY = this.m_bedHeightPixels / 2;
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async sendHome() 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      this.m_laserX = 0;
      this.m_laserY = 0;
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async sendAbsoluteMove(command) 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async sendRelativeMove(command) 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async startEngraving() 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async stopEngraving() 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    async engraveLine(lineData, lineNumber) 
    {
      if (this._isCleaningUp) {
        throw new Error('Device is being cleaned up');
      }
      return {
        status: 'error',
        message: 'not implemented'
      };
    }

    // Cleanup method to be called when the device is being destroyed
    async cleanup() {
        this._isCleaningUp = true;
        try {
            this._cleanupEventListeners();
            this.m_port = null;
            this.buffer = Buffer.alloc(0);
        } finally {
            this._isCleaningUp = false;
        }
    }
}

module.exports = Protocol; 