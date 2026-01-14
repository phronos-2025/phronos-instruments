import React from 'react';

const ConnectedDotPlot = () => {
  const data = [
    { label: 'You', relevance: 24, spread: 73, clues: ['magnetic', 'field', 'ekg', 'radiation', 'longing'] },
    { label: 'Haiku', relevance: 28, spread: 67, clues: ['longing', 'separation', 'ache', 'beat', 'mile'] },
    { label: 'Statistical', relevance: 34, spread: 55, clues: ['radius', 'spacing', 'dimensions', 'hart', 'velocity'] },
  ];

  const minVal = 0;
  const maxVal = 100;
  const scale = (val) => ((val - minVal) / (maxVal - minVal)) * 100;

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      color: '#e8e4d9',
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      padding: '40px',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <h1 style={{
        fontFamily: 'ui-serif, Georgia, serif',
        fontWeight: 400,
        fontSize: '28px',
        marginBottom: '12px',
        color: '#e8e4d9'
      }}>
        Common Ground Analysis
      </h1>
      
      <p style={{
        fontSize: '14px',
        color: '#888',
        marginBottom: '40px',
        fontStyle: 'italic'
      }}>
        heart ← · · · · · · · · · · · · · · · · · · → distance
      </p>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '32px',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#c4a962'
          }} />
          <span>Relevance</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: '2px solid #c4a962',
            backgroundColor: 'transparent',
            boxSizing: 'border-box'
          }} />
          <span>Spread</span>
        </div>
      </div>

      {/* Axis */}
      <div style={{ marginLeft: '100px', marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#666',
          marginBottom: '4px'
        }}>
          {[0, 25, 50, 75, 100].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div style={{
          height: '1px',
          backgroundColor: '#333',
          position: 'relative'
        }}>
          {[0, 25, 50, 75, 100].map(v => (
            <div key={v} style={{
              position: 'absolute',
              left: `${v}%`,
              top: '-3px',
              width: '1px',
              height: '7px',
              backgroundColor: '#444'
            }} />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {data.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Label */}
            <div style={{
              width: '100px',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: row.label === 'You' ? '#c4a962' : '#888'
            }}>
              {row.label}
            </div>

            {/* Track */}
            <div style={{
              flex: 1,
              height: '40px',
              position: 'relative',
              backgroundColor: '#222',
              borderRadius: '2px'
            }}>
              {/* Gridlines */}
              {[25, 50, 75].map(v => (
                <div key={v} style={{
                  position: 'absolute',
                  left: `${v}%`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  backgroundColor: '#2a2a2a'
                }} />
              ))}

              {/* Connecting line */}
              <div style={{
                position: 'absolute',
                left: `${scale(row.relevance)}%`,
                width: `${scale(row.spread) - scale(row.relevance)}%`,
                top: '50%',
                height: '2px',
                backgroundColor: '#c4a962',
                opacity: 0.4,
                transform: 'translateY(-50%)'
              }} />

              {/* Relevance dot (filled) */}
              <div style={{
                position: 'absolute',
                left: `${scale(row.relevance)}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#c4a962',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} />

              {/* Spread dot (hollow) */}
              <div style={{
                position: 'absolute',
                left: `${scale(row.spread)}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '2px solid #c4a962',
                backgroundColor: '#1a1a1a'
              }} />

              {/* Value labels */}
              <span style={{
                position: 'absolute',
                left: `${scale(row.relevance)}%`,
                top: '-2px',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                color: '#c4a962'
              }}>
                {row.relevance}
              </span>
              <span style={{
                position: 'absolute',
                left: `${scale(row.spread)}%`,
                top: '-2px',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                color: '#888'
              }}>
                {row.spread}
              </span>
            </div>

            {/* Gap indicator */}
            <div style={{
              width: '50px',
              textAlign: 'right',
              fontSize: '12px',
              color: '#666',
              marginLeft: '12px'
            }}>
              Δ {row.spread - row.relevance}
            </div>
          </div>
        ))}
      </div>

      {/* Clues panel */}
      <div style={{
        marginTop: '48px',
        borderTop: '1px solid #333',
        paddingTop: '24px'
      }}>
        <div style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: '#666',
          marginBottom: '16px'
        }}>
          Clues Given
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((row, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '16px',
              fontSize: '13px'
            }}>
              <span style={{
                width: '80px',
                color: row.label === 'You' ? '#c4a962' : '#666',
                textTransform: 'uppercase',
                fontSize: '11px'
              }}>
                {row.label}
              </span>
              <span style={{ color: '#888' }}>
                {row.clues.join(' · ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        backgroundColor: '#222',
        borderLeft: '2px solid #c4a962',
        fontSize: '13px',
        color: '#888',
        lineHeight: 1.6
      }}>
        <strong style={{ color: '#c4a962' }}>Reading:</strong> The gap (Δ) shows divergence—how 
        far your associations spread beyond tight relevance. Wider gaps suggest more exploratory, 
        less constrained associative thinking.
      </div>
    </div>
  );
};

export default ConnectedDotPlot;
