/** Browser-native audio processing keeps capture off the JavaScript render loop. */
export function microphoneAudioConstraints(
  deviceId = "",
  noiseSuppression = true,
): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}
export function screenCaptureOptions(shareTabAudio = false) {
  const supported = navigator.mediaDevices.getSupportedConstraints?.() as
    | (MediaTrackSupportedConstraints & {
        restrictOwnAudio?: boolean;
        suppressLocalAudioPlayback?: boolean;
      })
    | undefined;
  const audio: MediaTrackConstraints & {
    restrictOwnAudio?: boolean;
    suppressLocalAudioPlayback?: boolean;
  } = {
    echoCancellation: true,
    ...(supported?.restrictOwnAudio ? { restrictOwnAudio: true } : {}),
    ...(supported?.suppressLocalAudioPlayback
      ? { suppressLocalAudioPlayback: true }
      : {}),
  };
  return {
    video: { width: { ideal: 1280 }, frameRate: { ideal: 15, max: 20 } },
    audio: shareTabAudio ? audio : false,
    // Share other tabs' sound explicitly; never offer the call's system-audio mix.
    selfBrowserSurface: "exclude",
    systemAudio: "exclude",
    windowAudio: "exclude",
  } satisfies DisplayMediaStreamOptions & {
    selfBrowserSurface: string;
    systemAudio: string;
    windowAudio: string;
  };
}
