

let DEFAULT_SPEED = 45;
let DEFAULT_POWER = 100;

let g_deviceSettings = {
  m_speed: DEFAULT_SPEED,
  m_power: DEFAULT_POWER,
}

// Add event listeners for speed and power controls
document.addEventListener('DOMContentLoaded', () => {

  // Set initial values from defaults
  g_speedSlider.value = DEFAULT_SPEED;
  g_speedInput.value = DEFAULT_SPEED;
  g_powerSlider.value = DEFAULT_POWER;
  g_powerInput.value = DEFAULT_POWER;
});

// speed slider
g_speedSlider.addEventListener('input', () => {
  setSpeed(parseInt(g_speedSlider.value));
});

g_speedInput.addEventListener('input', (e) => {
  setSpeed(parseInt(e.target.value));
});

g_speedInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.target.blur();
    }
});

function setSpeed(value) {
  g_deviceSettings.m_speed = Math.max(1, Math.min(50, value));
  g_speedSlider.value = g_deviceSettings.m_speed;
  g_speedInput.value = g_deviceSettings.m_speed;
}

// Power control handlers
g_powerSlider.addEventListener('input', () => {
  setPower(parseInt(g_powerSlider.value));
});


g_powerInput.addEventListener('input', (e) => {
  setPower(parseInt(e.target.value));
});

g_powerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.target.blur();
    }
});

function setPower(value) {
  g_deviceSettings.m_power = Math.max(1, Math.min(100, value));
  g_powerSlider.value = g_deviceSettings.m_power;
  g_powerInput.value = g_deviceSettings.m_power;
}

