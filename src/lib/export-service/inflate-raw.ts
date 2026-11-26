/**
 * Synchronous raw-DEFLATE (RFC 1951) decoder. draw.io desktop stores `<diagram>` as
 * base64(deflateRaw(encodeURIComponent(xml))), and the paste/import path is synchronous, so the
 * async DecompressionStream is not an option. Throws on malformed input.
 */

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huffman {
  counts: number[];
  symbols: number[];
}

function buildHuffman(lengths: number[]): Huffman {
  const counts = new Array<number>(16).fill(0);
  for (const length of lengths) counts[length] = (counts[length] ?? 0) + 1;
  counts[0] = 0;
  const offsets = new Array<number>(16).fill(0);
  for (let i = 1; i < 16; i += 1) offsets[i] = offsets[i - 1]! + counts[i - 1]!;
  const symbols = new Array<number>(lengths.length).fill(0);
  lengths.forEach((length, symbol) => {
    if (length !== 0) {
      symbols[offsets[length]!] = symbol;
      offsets[length] = offsets[length]! + 1;
    }
  });
  return { counts, symbols };
}

const FIXED_LITERALS = buildHuffman([
  ...new Array<number>(144).fill(8),
  ...new Array<number>(112).fill(9),
  ...new Array<number>(24).fill(7),
  ...new Array<number>(8).fill(8),
]);
const FIXED_DISTANCES = buildHuffman(new Array<number>(30).fill(5));

/**
 * Output ceiling, the same 25 MB the workspace import accepts. A pasted or opened file is
 * untrusted: a few KB of DEFLATE can expand to gigabytes, so decoding stops here.
 */
export const INFLATE_MAX_OUTPUT_BYTES = 25 * 1024 * 1024;

export function inflateRaw(
  input: Uint8Array,
  maxOutputBytes: number = INFLATE_MAX_OUTPUT_BYTES,
): Uint8Array {
  let position = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let output = new Uint8Array(Math.max(1024, input.length * 4));
  let outLength = 0;

  const readBits = (count: number): number => {
    while (bitCount < count) {
      if (position >= input.length) throw new Error("inflate: unexpected end of data");
      bitBuffer |= input[position]! << bitCount;
      position += 1;
      bitCount += 8;
    }
    const value = bitBuffer & ((1 << count) - 1);
    bitBuffer >>>= count;
    bitCount -= count;
    return value;
  };

  const decode = (huffman: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length < 16; length += 1) {
      code |= readBits(1);
      const count = huffman.counts[length]!;
      if (code - count < first) return huffman.symbols[index + (code - first)]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("inflate: invalid code");
  };

  const push = (byte: number): void => {
    if (outLength >= maxOutputBytes) throw new Error("inflate: output exceeds the size limit");
    if (outLength === output.length) {
      const grown = new Uint8Array(output.length * 2);
      grown.set(output);
      output = grown;
    }
    output[outLength] = byte;
    outLength += 1;
  };

  const inflateBlock = (literals: Huffman, distances: Huffman): void => {
    for (;;) {
      const symbol = decode(literals);
      if (symbol < 256) {
        push(symbol);
      } else if (symbol === 256) {
        return;
      } else {
        const lengthIndex = symbol - 257;
        if (lengthIndex >= LENGTH_BASE.length) throw new Error("inflate: invalid length symbol");
        const length = LENGTH_BASE[lengthIndex]! + readBits(LENGTH_EXTRA[lengthIndex]!);
        const distanceSymbol = decode(distances);
        if (distanceSymbol >= DIST_BASE.length) throw new Error("inflate: invalid distance");
        const distance = DIST_BASE[distanceSymbol]! + readBits(DIST_EXTRA[distanceSymbol]!);
        if (distance > outLength) throw new Error("inflate: distance too far back");
        for (let i = 0; i < length; i += 1) push(output[outLength - distance]!);
      }
    }
  };

  const readDynamicTables = (): [Huffman, Huffman] => {
    const literalCount = readBits(5) + 257;
    const distanceCount = readBits(5) + 1;
    const codeLengthCount = readBits(4) + 4;
    const codeLengths = new Array<number>(19).fill(0);
    for (let i = 0; i < codeLengthCount; i += 1) codeLengths[CODE_LENGTH_ORDER[i]!] = readBits(3);
    const codeLengthTable = buildHuffman(codeLengths);
    const lengths: number[] = [];
    while (lengths.length < literalCount + distanceCount) {
      const symbol = decode(codeLengthTable);
      if (symbol < 16) {
        lengths.push(symbol);
        continue;
      }
      let repeat: number;
      let value = 0;
      if (symbol === 16) {
        if (lengths.length === 0) throw new Error("inflate: repeat with no previous length");
        value = lengths[lengths.length - 1]!;
        repeat = 3 + readBits(2);
      } else if (symbol === 17) {
        repeat = 3 + readBits(3);
      } else {
        repeat = 11 + readBits(7);
      }
      for (let i = 0; i < repeat; i += 1) lengths.push(value);
    }
    return [
      buildHuffman(lengths.slice(0, literalCount)),
      buildHuffman(lengths.slice(literalCount, literalCount + distanceCount)),
    ];
  };

  let isLast = false;
  while (!isLast) {
    isLast = readBits(1) === 1;
    const type = readBits(2);
    if (type === 0) {
      bitBuffer = 0;
      bitCount = 0;
      if (position + 4 > input.length) throw new Error("inflate: unexpected end of data");
      const length = input[position]! | (input[position + 1]! << 8);
      position += 4;
      if (position + length > input.length) throw new Error("inflate: unexpected end of data");
      for (let i = 0; i < length; i += 1) push(input[position + i]!);
      position += length;
    } else if (type === 1) {
      inflateBlock(FIXED_LITERALS, FIXED_DISTANCES);
    } else if (type === 2) {
      const [literals, distances] = readDynamicTables();
      inflateBlock(literals, distances);
    } else {
      throw new Error("inflate: invalid block type");
    }
  }
  return output.slice(0, outLength);
}
