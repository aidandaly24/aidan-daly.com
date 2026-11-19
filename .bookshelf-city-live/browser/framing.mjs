// The mock's outer book covers can meet the viewport edges. The bell, seats,
// hands and floor contacts must stay inside the frame at every aspect ratio.
const compositions = [
  {width: 1536, height: 1024, skyline: 248, centralSkyline: 248, floor: 957},
  {width: 948, height: 1659, skyline: 408, centralSkyline: 442, floor: 1546},
];

export function frameCity(camera, layout, width, height, titleBottom, footerTop, mastheadBottom = 0) {
  if (width <= 0 || height <= 0) return;
  const art = compositions[layout];
  const gap = Math.min(16, height * .014);
  const top = titleBottom + gap;
  const outerTop = mastheadBottom + gap;
  const bottom = Math.max(top + 1, footerTop - gap);
  const scale = Math.min(width / art.width,
    (bottom - outerTop) / (art.floor - art.skyline),
    (bottom - top) / (art.floor - art.centralSkyline));
  const viewWidth = width / scale;
  const viewHeight = height / scale;
  const desiredOffset = (height - art.height * scale) / 2;
  const offset = Math.max(outerTop - art.skyline * scale, top - art.centralSkyline * scale,
    Math.min(desiredOffset, bottom - art.floor * scale));
  camera.left = (art.width - viewWidth) / 2;
  camera.right = camera.left + viewWidth;
  camera.top = art.height + offset / scale;
  camera.bottom = camera.top - viewHeight;
  camera.updateProjectionMatrix();
}
