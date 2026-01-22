import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  const size = parseInt(req.query.size) || 180;

  // Clamp size to reasonable bounds
  const clampedSize = Math.min(Math.max(size, 16), 1024);

  try {
    // Read the SVG file
    const svgPath = join(process.cwd(), 'icon.svg');
    const svgBuffer = readFileSync(svgPath);

    // Convert to PNG at requested size
    const pngBuffer = await sharp(svgBuffer)
      .resize(clampedSize, clampedSize)
      .png()
      .toBuffer();

    // Set caching headers (cache for 1 year since icon rarely changes)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating icon:', error);
    res.status(500).json({ error: 'Failed to generate icon' });
  }
}
