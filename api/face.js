import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  const size = parseInt(req.query.size) || 100;
  const clampedSize = Math.min(Math.max(size, 32), 512);

  try {
    const imagePath = join(process.cwd(), 'coley.jpeg');
    const imageBuffer = readFileSync(imagePath);

    // Get image metadata to calculate crop area
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // Face is in the upper portion - crop a square around the face
    // Based on the image: face is roughly top 30% of image, centered
    const faceSize = Math.min(width, height * 0.35);
    const left = Math.floor((width - faceSize) / 2);
    const top = 0;

    const pngBuffer = await sharp(imageBuffer)
      .extract({
        left: left,
        top: top,
        width: Math.floor(faceSize),
        height: Math.floor(faceSize)
      })
      .resize(clampedSize, clampedSize)
      .png()
      .toBuffer();

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating face image:', error);
    res.status(500).json({ error: 'Failed to generate face image' });
  }
}
