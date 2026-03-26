import { toPng, toSvg } from 'html-to-image';

export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function exportAsPNG(element) {
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'diagram.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportAsSVG(element) {
  const dataUrl = await toSvg(element, {
    backgroundColor: '#ffffff',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'diagram.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
