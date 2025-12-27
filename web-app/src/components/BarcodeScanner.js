import React, { useRef, useEffect } from 'react';
import Quagga from 'quagga';

function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize Quagga barcode scanner
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          facingMode: "environment", // Use back camera
          width: { min: 640 },
          height: { min: 480 }
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: 4,
      frequency: 10,
      decoder: {
        readers: [
          "ean_reader",      // EAN-13 (most common)
          "ean_8_reader",    // EAN-8
          "upc_reader",      // UPC-A
          "upc_e_reader",    // UPC-E
        ]
      },
      locate: true
    }, (err) => {
      if (err) {
        console.error('Quagga init error:', err);
        alert('Failed to start camera');
        return;
      }
      Quagga.start();
    });

    // Handle successful scan
    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      console.log('Quagga detected:', code);
      
      // Validate the barcode (should be 8-13 digits)
      if (code && /^\d{8,13}$/.test(code)) {
        Quagga.stop();
        onScan(code);
      }
    });

    // Cleanup
    return () => {
      Quagga.stop();
      Quagga.offDetected();
    };
  }, [onScan]);

  return (
    <div className="barcode-scanner-modal">
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>Scan Barcode</h3>
          <p>Position barcode in the center</p>
        </div>
        <div ref={scannerRef} className="scanner-video"></div>
        <button onClick={() => {
          Quagga.stop();
          onClose();
        }} className="close-scanner-btn">
          Cancel
        </button>
      </div>
      <style jsx>{`
        .barcode-scanner-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .scanner-container {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 10px;
          padding: 20px;
        }
        .scanner-header {
          text-align: center;
          margin-bottom: 20px;
        }
        .scanner-video {
          width: 100%;
          height: 300px;
          position: relative;
          background: black;
        }
        .scanner-video video {
          width: 100%;
          height: 100%;
        }
        .scanner-video canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .close-scanner-btn {
          width: 100%;
          margin-top: 20px;
          padding: 12px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default BarcodeScanner;