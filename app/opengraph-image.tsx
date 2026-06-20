import { readFileSync } from 'fs';
import { join } from 'path';
import { ImageResponse } from 'next/og';

export const alt = 'Anker Protocol — Drop anchor on your yield.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const logoSrc = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'anker-logo.png'),
).toString('base64')}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#20304d',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 16, background: '#eaa53a' }} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 700,
            padding: '64px 48px 64px 76px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 999,
              border: '2px solid #eaa53a',
              color: '#f4c061',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            ANKER PROTOCOL
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 28,
              color: '#ffffff',
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -1,
            }}
          >
            Drop anchor on your yield.
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 26,
              maxWidth: 560,
              color: '#c9d2e0',
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.32,
            }}
          >
            CEX-style Dual Investment, built transparently on DeepBook Predict.
          </div>

          <div style={{ display: 'flex', marginTop: 36 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 999,
                background: '#eaa53a',
                color: '#20304d',
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              Sui testnet · BTC Buy Low
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ position: 'relative', display: 'flex', width: 372, height: 372 }}>
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                width: 340,
                height: 340,
                borderRadius: 40,
                background: '#16223a',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 340,
                height: 340,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 40,
                background: '#f4ecd6',
                border: '4px solid #16223a',
              }}
            >
              <img src={logoSrc} width={268} height={268} alt="" />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
