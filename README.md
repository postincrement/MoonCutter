# Basic Electron Application

A simple Electron.js application template.

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed
2. Clone this repository
3. Install dependencies:
```bash
npm install
```

## Running the Application

To start the application, run:
```bash
npm start
```

## Debugging

There are several ways to debug the application:

1. Main Process Debugging:
```bash
npm run debug        # Start with debugger attached
npm run debug-brk    # Start with debugger attached and break on first line
```

2. To debug the main process:
   - Start the app with `npm run debug`
   - Open Chrome and navigate to `chrome://inspect`
   - Click on "Open dedicated DevTools for Node"

3. To debug the renderer process:
   - Start the app normally
   - Press Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (macOS) to open DevTools
   - Or use the debug mode which opens DevTools automatically

## Features

- Basic Electron window setup
- Simple HTML/CSS interface
- Ready for development and customization
- Integrated debugging support
- Source maps enabled

## Development

The application consists of:
- `main.js` - Main Electron process
- `index.html` - Main window content
- `styles.css` - Basic styling

### Debugging Features
- Source maps for better debugging experience
- Crash reporting for renderer process
- Unresponsive window detection
- Uncaught exception handling 