

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
  g_speedValue.textContent = DEFAULT_SPEED;
  g_powerSlider.value = DEFAULT_POWER;
  g_powerInput.value = DEFAULT_POWER;
  g_powerValue.textContent = DEFAULT_POWER;

});

// speed slider
g_speedSlider.addEventListener('input', () => {
  g_deviceSettings.m_speed = g_speedSlider.value;
  g_speedValue.textContent = g_deviceSettings.m_speed;
});

g_powerSlider.addEventListener('input', () => {
  g_deviceSettings.m_power = g_powerSlider.value;
  g_powerValue.textContent = g_deviceSettings.m_power;
});


// Speed slider event
g_speedSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    g_speedInput.value = value;
    g_speedValue.textContent = value;
});

g_speedInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    // Clamp value between min and max
    value = Math.max(1, Math.min(10, value));
    g_speedSlider.value = value;
    g_speedValue.textContent = value;
});

g_speedInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.target.blur();
    }
});

// Power control handlers
g_powerSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    g_powerInput.value = value;
    g_powerValue.textContent = value;
});

g_powerInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    // Clamp value between min and max
    value = Math.max(1, Math.min(100, value));
    g_powerSlider.value = value;
    g_powerValue.textContent = value;
});

g_powerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.target.blur();
    }
});
