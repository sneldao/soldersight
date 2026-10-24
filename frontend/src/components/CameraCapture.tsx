import { useEffect, useRef, useState } from "react";
import { Button, ErrorPanel } from "./ui";

// Live camera input. Captures a still frame and hands it to onCapture as a JPEG blob.
export function CameraCapture({ onCapture, disabled }: { onCapture: (blob: Blob) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  async function start() {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(media);
      if (videoRef.current) videoRef.current.srcObject = media;
    } catch (err) {
      setError(err instanceof Error ? err.message : "camera unavailable");
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.92);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          borderRadius: "var(--radius)",
          background: "#000",
          display: stream ? "block" : "none",
        }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!stream ? (
          <Button variant="ghost" onClick={start}>Start camera</Button>
        ) : (
          <>
            <Button onClick={capture} disabled={disabled}>Capture and triage</Button>
            <Button variant="ghost" onClick={stop}>Stop camera</Button>
          </>
        )}
      </div>
      {error && <ErrorPanel message={`Camera error: ${error}`} onDismiss={() => setError(null)} />}
    </div>
  );
}
