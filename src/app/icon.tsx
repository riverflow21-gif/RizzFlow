import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const size = {
  width: 512,
  height: 512,
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
            width="512"
            height="512"
            style={{
              width: '512px',
              height: '512px',
              objectFit: 'cover',
              borderRadius: '115px',
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
            borderRadius: '115px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E3EED4',
            fontSize: 220,
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