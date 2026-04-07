/**
 * Join CTA — QR code and link to join the study.
 */

import React from 'react';

interface Props {
  slug: string;
  isActive: boolean;
}

export function JoinCTA({ slug, isActive }: Props) {
  const url = `instruments.phronos.org/studies/${slug}`;

  return (
    <div style={{
      textAlign: 'center',
      padding: '2rem 0',
    }}>
      {isActive && (
        <>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            textTransform: 'uppercase' as const,
            letterSpacing: '2px',
            color: 'var(--gold)',
            marginBottom: '1.5rem',
          }}>Join the Study</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <img
              src="/study-qr.png"
              alt={`QR code for ${url}`}
              style={{
                width: '120px',
                height: '120px',
                imageRendering: 'pixelated',
                opacity: 0.9,
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <a
                href={`/studies/${slug}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  color: 'var(--gold)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--gold-dim)',
                }}
              >
                {url}
              </a>
            </div>
          </div>
        </>
      )}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--faded)',
        marginTop: '2rem',
        letterSpacing: '0.5px',
      }}>
        &copy; Phronos {new Date().getFullYear()}
      </div>
    </div>
  );
}
