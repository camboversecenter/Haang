
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
