import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

function SimpleBarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    // Start scanning
    codeReader.decodeFromVideoDevice(
      undefined, // use default camera
      videoRef.current,
      (result, error) => {
        if (result) {
          console.log('ZXing scanned:', result.text);
          onScan(result.text);
          codeReader.reset();
        }
      }
    );

    // Cleanup
    return () => {
      codeReader.reset();
    };
  }, [onScan]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'black',
      zIndex: 9999
    }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      <button
        onClick={() => {
          if (readerRef.current) {
            readerRef.current.reset();
          }
          onClose();
        }}
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: 'red',
          color: 'white',
          border: 'none',
          borderRadius: 5,
          fontSize: 16
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default SimpleBarcodeScanner;