import type { Renderer } from '@ifc-lite/renderer';

export function setupCameraControls(canvas: HTMLCanvasElement, renderer: Renderer) {
  const camera = renderer.getCamera();

  let isDragging = false;
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  // Mouse down - start drag
  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    isPanning = e.button === 1 || e.button === 2 || e.shiftKey; // Middle/right click or shift = pan
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = isPanning ? 'move' : 'grabbing';
  };

  // Mouse move - orbit or pan
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (isPanning) {
      camera.pan(deltaX, deltaY);
    } else {
      camera.orbit(deltaX, deltaY);
    }

    renderer.render();
  };

  // Mouse up - stop drag
  const onMouseUp = () => {
    isDragging = false;
    isPanning = false;
    canvas.style.cursor = 'grab';
  };

  // Mouse leave - stop drag
  const onMouseLeave = () => {
    isDragging = false;
    isPanning = false;
  };

  // Scroll wheel - zoom
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom towards mouse position
    camera.zoom(e.deltaY, false, mouseX, mouseY, canvas.width, canvas.height);
    renderer.render();
  };

  // Prevent context menu on right-click
  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  // Set initial cursor
  canvas.style.cursor = 'grab';

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.style.cursor = '';
  };
}