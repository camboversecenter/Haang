
import { Sale, Shop } from '../types';

// Standard UUIDs for Bluetooth Thermal Printers
const SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

// Web Bluetooth API Type Definitions
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}

export class PrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        alert("Web Bluetooth is not supported in this browser. Please use Chrome on Android or Desktop.");
        return false;
      }

      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      if (this.device?.gatt) {
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Bluetooth Connection Error:", error);
      return false;
    }
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  isConnected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic;
  }

  // ESC/POS Commands
  private readonly CMD = {
    INIT: '\x1B\x40',
    TEXT_FORMAT: '\x1B\x21',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_RIGHT: '\x1B\x61\x02',
    BOLD_ON: '\x1B\x45\x01',
    BOLD_OFF: '\x1B\x45\x00',
    LF: '\x0A', // Line Feed
    CUT: '\x1D\x56\x41\x00', // Cut paper
  };

  async printReceipt(sale: Sale, shop: Shop) {
    if (!this.isConnected()) {
      const connected = await this.connect();
      if (!connected) throw new Error("Printer not connected");
    }

    // Khmer (and any non-Latin) text cannot be sent as raw bytes — ESC/POS
    // printers use single-byte code pages and would print garbage. Render the
    // receipt to a canvas with the app's Khmer fonts and print it as a raster
    // image instead. Fall back to plain text mode if canvas rendering fails.
    try {
      const canvas = await this.renderReceiptCanvas(sale, shop);
      await this.printCanvas(canvas);
      return;
    } catch (e) {
      console.warn('[printer] raster print failed, falling back to text mode', e);
    }
    await this.printReceiptText(sale, shop);
  }

  /** Render the receipt into a 384px-wide monochrome-friendly canvas (58mm @ 203dpi). */
  private async renderReceiptCanvas(sale: Sale, shop: Shop): Promise<HTMLCanvasElement> {
    const WIDTH = 384;
    const PAD = 8;
    const MAX_W = WIDTH - PAD * 2;
    const FONT = '"Kantumruy Pro", "Noto Sans Khmer", "Khmer OS", sans-serif';

    // Make sure the Khmer webfonts are loaded before measuring/drawing
    try { await (document as any).fonts?.ready; } catch { /* older browsers */ }

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d')!;

    type Line =
      | { kind: 'text'; text: string; size: number; bold: boolean; align: 'left' | 'center' | 'right' }
      | { kind: 'row'; left: string; right: string; size: number; bold: boolean }
      | { kind: 'sep' }
      | { kind: 'gap'; h: number };

    const lines: Line[] = [];
    const font = (size: number, bold: boolean) => `${bold ? '700' : '400'} ${size}px ${FONT}`;

    // Wrap text to the printable width. Khmer has no spaces, so fall back to
    // per-character wrapping when a single "word" exceeds the line.
    const wrapText = (text: string, size: number, bold: boolean): string[] => {
      mctx.font = font(size, bold);
      const out: string[] = [];
      for (const rawLine of String(text).split('\n')) {
        let current = '';
        for (const ch of rawLine) {
          const candidate = current + ch;
          if (mctx.measureText(candidate).width > MAX_W && current !== '') {
            const lastSpace = current.lastIndexOf(' ');
            if (lastSpace > 0 && ch !== ' ') {
              out.push(current.slice(0, lastSpace));
              current = current.slice(lastSpace + 1) + ch;
            } else {
              out.push(current);
              current = ch === ' ' ? '' : ch;
            }
          } else {
            current = candidate;
          }
        }
        out.push(current);
      }
      return out;
    };

    const addText = (text: string, size: number, opts: { bold?: boolean; align?: 'left' | 'center' | 'right' } = {}) => {
      for (const l of wrapText(text, size, !!opts.bold)) {
        lines.push({ kind: 'text', text: l, size, bold: !!opts.bold, align: opts.align || 'left' });
      }
    };
    const addRow = (left: string, right: string, size: number, bold = false) =>
      lines.push({ kind: 'row', left, right, size, bold });

    const money = (n: number) => `${Math.round(n).toLocaleString()}`;

    // --- Compose the receipt ---
    addText(shop.name, 30, { bold: true, align: 'center' });
    if (shop.address) addText(shop.address, 18, { align: 'center' });
    if (shop.phone) addText(`Tel: ${shop.phone}`, 18, { align: 'center' });
    lines.push({ kind: 'gap', h: 6 });
    addText(new Date(sale.timestamp).toLocaleString(), 18, { align: 'center' });
    addText(`Order #${sale.id.slice(-6).toUpperCase()}`, 18, { align: 'center' });
    lines.push({ kind: 'sep' });

    for (const item of sale.items) {
      const unitPrice = item.finalPrice ?? item.price;
      addText(`${item.name}${item.variantName ? ` (${item.variantName})` : ''}`, 22);
      if (item.appliedDiscount && item.appliedDiscount.amountSaved > 0) {
        addRow(`  ${item.quantity} x ${money(unitPrice)} (-${money(item.appliedDiscount.amountSaved)})`, money(unitPrice * item.quantity), 19);
      } else {
        addRow(`  ${item.quantity} x ${money(unitPrice)}`, money(unitPrice * item.quantity), 19);
      }
    }

    lines.push({ kind: 'sep' });
    if (sale.tax > 0 || sale.subtotal !== sale.total) {
      addRow('Subtotal', `${money(sale.subtotal)} KHR`, 19);
      if (sale.tax > 0) addRow('VAT / Tax', `${money(sale.tax)} KHR`, 19);
    }
    addRow('Total / សរុប', `${money(sale.total)} KHR`, 26, true);
    if (sale.paymentMethod) addRow('Payment', sale.paymentMethod.toUpperCase(), 18);
    lines.push({ kind: 'sep' });
    addText('សូមអរគុណ! Thank You!', 22, { bold: true, align: 'center' });
    addText('Powered by Little Tony APP', 16, { align: 'center' });

    // --- Layout & draw ---
    const lineHeight = (size: number) => Math.ceil(size * 1.6); // Khmer glyphs stack vertically
    let height = PAD;
    for (const l of lines) {
      if (l.kind === 'sep') height += 14;
      else if (l.kind === 'gap') height += l.h;
      else height += lineHeight(l.size);
    }
    height += 60; // paper feed

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, WIDTH, height);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    let y = PAD;
    for (const l of lines) {
      if (l.kind === 'sep') {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD, y + 6);
        ctx.lineTo(WIDTH - PAD, y + 6);
        ctx.stroke();
        ctx.restore();
        y += 14;
      } else if (l.kind === 'gap') {
        y += l.h;
      } else if (l.kind === 'text') {
        ctx.font = font(l.size, l.bold);
        const w = ctx.measureText(l.text).width;
        const x = l.align === 'center' ? (WIDTH - w) / 2 : l.align === 'right' ? WIDTH - PAD - w : PAD;
        ctx.fillText(l.text, Math.max(PAD, x), y);
        y += lineHeight(l.size);
      } else {
        ctx.font = font(l.size, l.bold);
        const rw = ctx.measureText(l.right).width;
        ctx.fillText(l.left, PAD, y);
        ctx.fillText(l.right, WIDTH - PAD - rw, y);
        y += lineHeight(l.size);
      }
    }
    return canvas;
  }

  /** Convert a canvas to ESC/POS raster commands (GS v 0) and send it in slices. */
  private async printCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const widthBytes = Math.ceil(width / 8);
    const pixels = ctx.getImageData(0, 0, width, height).data;

    const encoder = new TextEncoder();
    await this.writeChunked(encoder.encode(this.CMD.INIT));

    const SLICE_ROWS = 96; // print in bands so cheap printers don't overflow
    for (let startY = 0; startY < height; startY += SLICE_ROWS) {
      const rows = Math.min(SLICE_ROWS, height - startY);
      const body = new Uint8Array(8 + widthBytes * rows);
      body.set([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff], 0);
      let o = 8;
      for (let yy = 0; yy < rows; yy++) {
        const py = startY + yy;
        for (let bx = 0; bx < widthBytes; bx++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const px = bx * 8 + bit;
            if (px < width) {
              const i = (py * width + px) * 4;
              // luminance threshold — anti-aliased text edges become black
              const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
              if (lum < 160) byte |= (0x80 >> bit);
            }
          }
          body[o++] = byte;
        }
      }
      await this.writeChunked(body);
    }

    await this.writeChunked(encoder.encode(this.CMD.LF + this.CMD.LF + this.CMD.LF));
  }

  /** Write a payload in small chunks with pacing (BLE GATT + cheap printer buffers). */
  private async writeChunked(payload: Uint8Array) {
    const CHUNK = 200;
    for (let i = 0; i < payload.length; i += CHUNK) {
      await this.characteristic?.writeValue(payload.slice(i, i + CHUNK));
      await new Promise(r => setTimeout(r, 20));
    }
  }

  /** Legacy plain-text printing (ASCII only — used as fallback). */
  private async printReceiptText(sale: Sale, shop: Shop) {
    const encoder = new TextEncoder();
    const data: Uint8Array[] = [];

    const addText = (text: string) => data.push(encoder.encode(text));
    const addCmd = (cmd: string) => data.push(encoder.encode(cmd));

    // 1. Header
    addCmd(this.CMD.INIT);
    addCmd(this.CMD.ALIGN_CENTER);
    addCmd(this.CMD.BOLD_ON);
    addText(shop.name + this.CMD.LF);
    addCmd(this.CMD.BOLD_OFF);
    if(shop.phone) addText(`Tel: ${shop.phone}` + this.CMD.LF);
    addText(`Date: ${new Date(sale.timestamp).toLocaleString()}` + this.CMD.LF);
    addText(`Order: #${sale.id.slice(-6)}` + this.CMD.LF);
    addText('--------------------------------' + this.CMD.LF);

    // 2. Items
    addCmd(this.CMD.ALIGN_LEFT);
    sale.items.forEach(item => {
      // Name line
      addText(item.name + this.CMD.LF);
      // Qty x Price line
      const qtyPrice = `${item.quantity} x ${item.price.toLocaleString()}`;
      const total = (item.quantity * item.price).toLocaleString();
      // Simple spacing logic (assuming 32 chars width for 58mm)
      const spaces = 32 - qtyPrice.length - total.length;
      addText(`${qtyPrice}${' '.repeat(Math.max(1, spaces))}${total}` + this.CMD.LF);
    });

    addText('--------------------------------' + this.CMD.LF);

    // 3. Totals
    addCmd(this.CMD.ALIGN_RIGHT);
    addCmd(this.CMD.BOLD_ON);
    addText(`Total: ${sale.total.toLocaleString()} KHR` + this.CMD.LF);
    addCmd(this.CMD.BOLD_OFF);
    
    // 4. Footer
    addCmd(this.CMD.ALIGN_CENTER);
    addText(this.CMD.LF + "Thank You!" + this.CMD.LF);
    addText("Powered by Little Tony APP" + this.CMD.LF);
    addText(this.CMD.LF + this.CMD.LF + this.CMD.LF); // Feed
    // addCmd(this.CMD.CUT); // Optional: Cut paper

    // Send chunks
    for (const chunk of data) {
      await this.characteristic?.writeValue(chunk);
      // Small delay to prevent buffer overflow on cheap printers
      await new Promise(r => setTimeout(r, 50)); 
    }
  }
}

export const printer = new PrinterService();
