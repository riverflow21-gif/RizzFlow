import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const size = {
  width: 128,
  height: 128,
};

export const contentType = 'image/png';

export default function Icon() {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    const logoBuffer = fs.readFileSync(logoPath);
    const base64Logo = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
          }}
        >
          <img
            src={base64Logo}
            alt="RizzFlow"
            width="128"
            height="128"
            style={{
              width: '128px',
              height: '128px',
              objectFit: 'cover',
              borderRadius: '32px', // Bentuk Kotak Tumpul (Rounded Square)
            }}
          />
        </div>
      ),
      { ...size }
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#0F2A1D',
            borderRadius: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E3EED4',
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          R
        </div>
      ),
      { ...size }
    );
  }
}