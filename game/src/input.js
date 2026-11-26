// Keyboard and mouse: arrows or WASD to fly, mouse to steer, a few keys
// for throttle, pause and sound. Keys are tracked as a held set so the
// plane answers smoothly instead of in steps.
export function makeInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    usingMouse: false,
    // True while the named control is held down.
    held(name) {
      return keys.has(name);
    },
    // Roll input: -1 is left, +1 is right.
    rollAxis() {
      let axis = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) axis -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) axis += 1;
      if (input.usingMouse) axis += Math.max(-1, Math.min(1, input.mouseX * 2.2));
      return Math.max(-1, Math.min(1, axis));
    },
    // Pitch input: -1 is nose down, +1 is nose up.
    pitchAxis() {
      let axis = 0;
      if (keys.has('ArrowUp') || keys.has('KeyW')) axis += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) axis -= 1;
      if (input.usingMouse) axis -= Math.max(-1, Math.min(1, input.mouseY * 2.2));
      return Math.max(-1, Math.min(1, axis));
    },
    // Throttle input: +1 faster, -1 slower.
    throttleAxis() {
      let axis = 0;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal')) axis += 1;
      if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus')) axis -= 1;
      return axis;
    },
  };

  const down = (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
  };
  const up = (event) => keys.delete(event.code);
  const blur = () => keys.clear();
  const mouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    input.mouseY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    input.mouseActive = true;
  };
  const mouseDown = () => {
    input.usingMouse = true;
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);

  // A key pressed once since the last check (for menus and toggles).
  const pressed = new Set();
  const pressDown = (event) => pressed.add(event.code);
  window.addEventListener('keydown', pressDown);
  input.wasPressed = (code) => {
    const hit = pressed.has(code);
    if (hit) pressed.delete(code);
    return hit;
  };
  input.clearPressed = () => pressed.clear();

  return input;
}
