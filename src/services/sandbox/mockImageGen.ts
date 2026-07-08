/**
 * mockImageGen — Simulación determinista de Imagen 3.
 * Spec: ARCH-20260705-04 + SPEC-20260705-04 §2.3
 *
 * Devuelve un PNG 512×512 con un patrón visual distintivo + overlay SANDBOX.
 * El cliente `keyframeGenerator.generateKeyframeOut` espera
 * `{ blob, base64, mimeType, prompt }`, así que la shape del mock coincide
 * exactamente con la del cliente real (`geminiClient.generateImage`).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Devuelve PNG con grid + texto del prompt + sello SANDBOX. */
export async function mockGenerateImage(
  prompt: string,
): Promise<{ blob: Blob; mimeType: string; bytesBase64Encoded: string }> {
  await sleep(1500 + Math.random() * 1500);
  const W = 512;
  const H = 512;
  // ARCH-20260705-04: jsdom y entornos sin canvas 2D caen a PNG mínimo válido.
  // En el browser se renderiza el overlay; en tests basta con shape correcta.
  let blob: Blob;
  try {
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');

    // Fondo degradado distintivo
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#0ea5e9');
    grad.addColorStop(1, '#6366f1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cuadrícula sutil
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(W, i);
      ctx.stroke();
    }

    // Texto SANDBOX
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧪 SANDBOX IMG', W / 2, 230);
    ctx.font = '12px monospace';
    ctx.fillText(prompt.slice(0, 60), W / 2, 260);
    ctx.fillText('Toggle VITE_USE_SANDBOX=false para real', W / 2, 280);

    // Sello diagonal
    ctx.save();
    ctx.translate(W / 2, H / 2 + 80);
    ctx.rotate(-Math.PI / 8);
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.fillText('SIMULATED', 0, 0);
    ctx.restore();

    blob = await canvas.convertToBlob({ type: 'image/png' });
  } catch {
    // Fallback: PNG header mínimo + pixel transparente.
    blob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])],
      { type: 'image/png' },
    );
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let bin = '';
  // Procesar en chunks para evitar stack overflow con buffers grandes
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const bytesBase64Encoded = btoa(bin);

  return { blob, mimeType: 'image/png', bytesBase64Encoded };
}