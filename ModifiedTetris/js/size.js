/*function adjustViewport() {
  const width = window.innerWidth;
  console.log(`Current width: ${width}`);
  const viewport = document.querySelector("meta[name=viewport]");

  if (!viewport) {
      console.error('Viewport meta tag not found!');
      return;
  }

  if (width <= 1920) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=0.5');
      console.log('Setting zoom to 60%');
  } else {
      viewport.setAttribute('content', 'width=device-width, initial-scale=0.8');
      console.log('Setting zoom to 80%');
  }
}

document.addEventListener('DOMContentLoaded', (event) => {
  adjustViewport();
  window.addEventListener('resize', adjustViewport);
});

*/
function adjustViewport() {
  const width = window.innerWidth;
  const scale = width <= 1920 ? 1.3 : 2.2; // 50% scale for <=1920px, 80% for >1920px
  const bodyStyle = document.body.style;

  bodyStyle.transformOrigin = 'top left'; // Set the origin of transformation
  bodyStyle.transform = `scale(${scale})`; // Apply scaling
  bodyStyle.width = `${100 / scale}%`; // Adjust width to fit the scaled content
  bodyStyle.height = `${100 / scale}%`; // Adjust height to fit the scaled content
}

document.addEventListener('DOMContentLoaded', (event) => {
  adjustViewport();
  window.addEventListener('resize', adjustViewport);
});
