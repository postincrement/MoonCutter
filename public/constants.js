// Shared constants for MoonCutter
const BORDER = 60;


function logMessage(type, ...items) {
  const formattedMessage = items.map(item => {
    if (typeof item === 'object') {
      try {
        return JSON.stringify(item, null, 2); 
      } catch (e) {
        return String(item);
      }
    }
    return String(item);
  }).join(' ');
  console.log(formattedMessage);
  window.api.logMessage(formattedMessage, type);
}