import { useEffect, useRef, useState } from 'react';

export type CameraState = 'off' | 'starting' | 'on' | 'unsupported' | 'denied';

/** The back camera, for AR and horizon sweeps. Video stays on the device (§7). */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraState>('off');

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    setState('starting');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => undefined);
        }
        setState('on');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return { videoRef, state };
}
