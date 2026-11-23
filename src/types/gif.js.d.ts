declare module "gif.js" {
  interface GIFOptions {
    workerScript?: string;
    workers?: number;
    repeat?: number;
    background?: string;
    quality?: number;
    width?: number | null;
    height?: number | null;
    transparent?: number | null;
    debug?: boolean;
    dither?: boolean | string;
    globalPalette?: boolean;
  }

  interface GIFFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  type GIFFrameSource = ImageData | CanvasRenderingContext2D | HTMLCanvasElement | HTMLImageElement;

  class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: GIFFrameSource, options?: GIFFrameOptions): void;
    render(): void;
    abort(): void;
    on(event: "finished", listener: (blob: Blob, data: Uint8Array) => void): this;
    on(event: "progress", listener: (progress: number) => void): this;
    on(event: "start" | "abort", listener: () => void): this;
  }

  export default GIF;
}

declare module "gif.js/dist/gif.worker.js?url" {
  const url: string;
  export default url;
}
