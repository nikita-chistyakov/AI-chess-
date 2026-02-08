
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

const map: Map<string, AudioContext> = new Map();
let interactionPromise: Promise<void> | null = null;

function ensureUserInteraction() {
  if (!interactionPromise) {
    interactionPromise = new Promise(resolve => {
      const handler = () => {
        window.removeEventListener('pointerdown', handler, true);
        window.removeEventListener('keydown', handler, true);
        resolve();
      };
      window.addEventListener('pointerdown', handler, true);
      window.addEventListener('keydown', handler, true);
    });
  }
  return interactionPromise;
}

export const audioContext = async (options?: GetAudioContextOptions): Promise<AudioContext> => {
  const id = options?.id || 'default';
  if (map.has(id)) {
    const ctx = map.get(id)!;
    if (ctx.state === 'suspended') {
      await ensureUserInteraction();
      await ctx.resume().catch(console.error);
    }
    return ctx;
  }

  let ctx: AudioContext;
  try {
    ctx = new AudioContext(options);
  } catch (e) {
    await ensureUserInteraction();
    ctx = new AudioContext(options);
  }
  
  if (ctx.state === 'suspended') {
    await ensureUserInteraction();
    await ctx.resume().catch(console.error);
  }

  map.set(id, ctx);
  return ctx;
};

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const pieceToUnicode: { [key: string]: string } = {
  // black pieces
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎',
  // white pieces
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
};

export const pieceTypeMap: Record<string, string> = { 
  p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" 
};

// Helper function to determine if a square is light or dark.
// Standard chess: a1 is dark. (file 0, rank 0) => 0+0 even => dark.
export const getSquareColor = (square: string): 'light' | 'dark' => {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
  const rank = parseInt(square[1], 10) - 1; // 0-7
  return (file + rank) % 2 === 0 ? 'dark' : 'light';
};

// Helper function to convert hex color to rgba
export const hexToRgba = (hex: string, alpha: number): string => {
  // Ensure hex is a valid 6-digit hex string
  const validHex = hex.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
  if (!validHex) {
    console.warn(`Invalid hex color: ${hex}. Defaulting to black.`);
    return `rgba(0, 0, 0, ${alpha})`;
  }
  
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const hexValue = parseInt(`0x${c.join('')}`);

  const r = (hexValue >> 16) & 255;
  const g = (hexValue >> 8) & 255;
  const b = hexValue & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
