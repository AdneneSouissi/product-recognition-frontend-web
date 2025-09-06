import React, { useRef, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:8000/predict';

function drawBoxes(ctx, predictions, scaleX = 1, scaleY = 1) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  predictions.forEach(pred => {
    const [x1, y1, x2, y2] = pred.bbox;
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#00FF00';
    ctx.fillText(`${pred.class}`, x1 * scaleX, y1 * scaleY > 20 ? y1 * scaleY - 5 : y1 * scaleY + 20);
  });
}

function App() {
  const [image, setImage] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useWebcam, setUseWebcam] = useState(false);
  const [wsActive, setWsActive] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const fileInputRef = useRef();
  const wsRef = useRef();


  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const imgURL = URL.createObjectURL(file);
    setImage(imgURL);
    setUseWebcam(false);
    setPredictions([]);
  };


  const sendToBackend = async (fileOrBlob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', fileOrBlob);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      alert('Prediction failed.');
    }
    setLoading(false);
  };


  const startWebcam = async () => {
    setUseWebcam(true);
    setImage(null);
    setPredictions([]);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }

    if (!wsRef.current || wsRef.current.readyState !== 1) {
      const socket = new window.WebSocket('ws://localhost:8000/ws/predict');
      wsRef.current = socket;
      socket.onopen = () => {
        setWsActive(true);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.predictions) setPredictions(data.predictions);
        } catch (e) {}
      };
      socket.onerror = () => {
        setWsActive(false);
        wsRef.current = null;
      };
      socket.onclose = () => {
        setWsActive(false);
        wsRef.current = null;
      };
    }
  };


  const stopWebcam = () => {
    setUseWebcam(false);
    setPredicting(false);
    setPredictions([]);
    setImage(null); 
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const predictImage = async () => {
    if (image && !useWebcam) {
      setLoading(true);
      const response = await fetch(image);
      const blob = await response.blob();
      await sendToBackend(blob);
      setLoading(false);
    }
  };


  React.useEffect(() => {
    let interval;
    if (useWebcam && wsRef.current && wsRef.current.readyState === 1 && predicting) {
      interval = setInterval(() => {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob && wsRef.current && wsRef.current.readyState === 1) {
            wsRef.current.send(blob);
            setImage(canvas.toDataURL());
          }
        }, 'image/jpeg');
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [useWebcam, wsActive, predicting]);


  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);


  const captureAndPredict = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      await sendToBackend(blob);
      setImage(canvas.toDataURL());
    }, 'image/jpeg');
  };

 
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (useWebcam) {
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      const video = videoRef.current;
      let scaleX = 1, scaleY = 1;
      if (video && video.videoWidth && video.videoHeight) {
        scaleX = canvas.width / video.videoWidth;
        scaleY = canvas.height / video.videoHeight;
      }
      drawBoxes(ctx, predictions, scaleX, scaleY);
    } else if (image) {
     
      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        const scaleX = 400 / img.width;
        const scaleY = 300 / img.height;
        drawBoxes(ctx, predictions, scaleX, scaleY);
      };
      img.src = image;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [image, predictions, useWebcam]);

  // Save all detected products to database (webcam mode)
  const saveAllToDatabase = async () => {
    if (!videoRef.current || predictions.length === 0) return;
    const video = videoRef.current;
    // Get the current frame as a blob
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('predictions', JSON.stringify(predictions));
      try {
        await fetch('http://localhost:8000/add_to_database', {
          method: 'POST',
          body: formData,
        });
        alert('All detected products saved to database!');
      } catch (err) {
        alert('Failed to save to database.');
      }
    }, 'image/jpeg');
  };

  return (
    <div className="container" style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#181c24', color: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 24px #0002' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>🛒 Real-Time Product Recognition</h1>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => fileInputRef.current.click()} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#0078d4', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Upload Image</button>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
        {!useWebcam ? (
          <button onClick={startWebcam} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#00b96b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Start Webcam
          </button>
        ) : (
          <button onClick={stopWebcam} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#d40000', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Stop Webcam
          </button>
        )}
        <button
          onClick={async () => {
            if (useWebcam) {
              setPredicting(p => !p);
            } else {
              await predictImage();
            }
          }}
          disabled={(!useWebcam && !image) || (useWebcam && !wsActive)}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: (!useWebcam && !image) || (useWebcam && !wsActive)
              ? '#888'
              : predicting && useWebcam
                ? '#ffb300'
                : '#0078d4',
            color: '#fff',
            fontWeight: 600,
            cursor: (!useWebcam && !image) || (useWebcam && !wsActive) ? 'not-allowed' : 'pointer',
            opacity: (!useWebcam && !image) || (useWebcam && !wsActive) ? 0.7 : 1
          }}
        >
          {useWebcam
            ? predicting
              ? 'Stop Prediction'
              : 'Start Prediction'
            : image
              ? 'Predict Image'
              : 'Predict'}
        </button>
        {useWebcam && wsActive && (
          <span style={{ marginLeft: 8, color: '#00ff90', fontWeight: 600 }}>WebSocket Connected</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        <div>
          {useWebcam ? (
            <div style={{ position: 'relative', width: 400, height: 300 }}>
              <video
                ref={videoRef}
                width={400}
                height={300}
                autoPlay
                muted
                style={{ border: '1px solid #222', borderRadius: 8, position: 'absolute', left: 0, top: 0, background: '#000' }}
              />
              <canvas
                ref={canvasRef}
                width={400}
                height={300}
                style={{ border: '1px solid #222', borderRadius: 8, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
              />
            </div>
          ) : (
            image && (
              <div style={{ position: 'relative', width: 400, height: 300 }}>
                <img
                  src={image}
                  alt="Uploaded"
                  style={{ width: 400, height: 300, objectFit: 'contain', border: '1px solid #222', borderRadius: 8, position: 'absolute', left: 0, top: 0, background: '#000' }}
                />
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={300}
                  style={{ border: '1px solid #222', borderRadius: 8, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
                />
              </div>
            )
          )}
        </div>
        <div style={{ minWidth: 260 }}>
          {loading && <p style={{ color: '#ffb300' }}>Predicting...</p>}
          {predictions.length > 0 && (
            <div style={{ background: '#23283a', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <h3 style={{ margin: 0, marginBottom: 12, color: '#00b96b' }}>Predictions</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {predictions.map((pred, idx) => (
                  <li key={idx} style={{ marginBottom: 8, fontSize: 16 }}>
                    <b style={{ color: '#ffb300' }}>{pred.class}</b> <span style={{ color: '#fff' }}>({pred.confidence})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {useWebcam && predictions.length > 0 && (
        <button
          onClick={saveAllToDatabase}
          style={{
            marginTop: 12,
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#ffb300',
            color: '#222',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'block'
          }}
        >
          Save to Database
        </button>
      )}
    </div>
  );
}

export default App;
