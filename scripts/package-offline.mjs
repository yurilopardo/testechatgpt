import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

// A small standard ZIP writer keeps the offline package independent of OS tools.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const files = [
  ["jogar.html", await readFile("jogar.html")],
  ["teste-isometrico.html", await readFile("teste-isometrico.html")],
  ["editor-offline.html", await readFile("editor-offline.html")],
  ["banco-de-ideias.txt", await readFile("banco-de-ideias.txt")],
  ["fase-exemplo.json", await readFile("public/fase-exemplo.json")],
  [
    "LEIA-ME.txt",
    Buffer.from(
      "TRÍADE TÁTICA\n\nAbra jogar.html para jogar ou editor-offline.html para criar fases.\nAbra teste-isometrico.html para o teste visual reduzido: mapa fixo, três ninjas e um inimigo.\nOs arquivos funcionam offline, sem instalação.\n\nNo editor: Baixar fase salva JSON; Baixar fase jogável salva um HTML independente.\nFases salvas na biblioteca ficam apenas neste navegador; exporte para guardar.\nTiles com ◇ mostram quais efeitos ainda estão em planejamento.\n",
      "utf8",
    ),
  ],
];
const chunks = [],
  directory = [];
let offset = 0;
for (const [name, data] of files) {
  const filename = Buffer.from(name),
    compressed = deflateRawSync(data),
    crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE(offset, 42);
  chunks.push(header, filename, compressed);
  directory.push(central, filename);
  offset += header.length + filename.length + compressed.length;
}
const central = Buffer.concat(directory),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile("triade-tatica.zip", Buffer.concat([...chunks, central, end]));
await mkdir("dist", { recursive: true });
for (const file of [
  "jogar.html",
  "teste-isometrico.html",
  "editor-offline.html",
  "triade-tatica.zip",
])
  await copyFile(file, `dist/${file}`);
console.log(
  "Pacote offline: triade-tatica.zip — jogo, editor e banco de ideias.",
);
