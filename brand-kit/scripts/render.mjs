#!/usr/bin/env node
// Use SHARP_MODULE only when an existing shared runtime supplies Sharp.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(process.env.SHARP_MODULE).href : 'sharp');
const jobs = JSON.parse(await fs.readFile(path.join(root,'scripts/render-jobs.json'),'utf8'));
for (const job of jobs) {
  const output = path.join(root,job.output);
  await fs.mkdir(path.dirname(output),{recursive:true});
  // Render at 3x final resolution and downsample for clean small-size antialiasing.
  const source = await fs.readFile(path.join(root,job.source));
  const metadata = await sharp(source).metadata();
  const height = job.height || Math.round(job.width * metadata.height / metadata.width);
  const rendered = await sharp(source,{density:216}).resize(job.width*3,height*3,{fit:'fill'}).png().toBuffer();
  let final = sharp(rendered).resize(job.width,height,{kernel:'lanczos3'});
  // Rasterizers can leave fractional alpha on the outer edge of a full-canvas rect.
  // Flatten only SVGs whose ROOT has an explicit full-canvas background.
  const background = source.toString().match(/<\/desc>(?:<defs>[\s\S]*?<\/defs>)?<rect width="[^"]+" height="[^"]+" fill="([^"]+)"/);
  if (background) final = final.flatten({background:background[1]});
  await final.png({compressionLevel:9}).toFile(output);
}
console.log(`Rendered ${jobs.length} PNG files.`);
