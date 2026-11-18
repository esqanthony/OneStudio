import AVFoundation

/// How a session's takes are captured. Chosen once per recording session and never
/// changed mid-session, so every take joins into the same geometry.
enum CaptureStrategy: String {
  /// 9:16 vertical video.
  case portrait
  /// 16:9 landscape while the phone is upright, using the front camera's square sensor
  /// (iOS 26 dynamic aspect ratio: iPhone 17 series, iPhone Air). Full quality.
  case nativeLandscape = "native-landscape"
  /// 16:9 landscape cut out of a vertical recording. Lower resolution.
  case crop
}

enum CameraCapabilities {
  /// Device types worth checking, in order of preference.
  static let deviceTypes: [AVCaptureDevice.DeviceType] = [
    .builtInUltraWideCamera,
    .builtInWideAngleCamera,
    .builtInTrueDepthCamera
  ]

  static func devices(position: AVCaptureDevice.Position) -> [AVCaptureDevice] {
    AVCaptureDevice.DiscoverySession(
      deviceTypes: deviceTypes,
      mediaType: .video,
      position: position
    ).devices
  }

  /// The camera used for portrait and crop recording.
  static func standardDevice(position: AVCaptureDevice.Position) -> AVCaptureDevice? {
    AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
      ?? devices(position: position).first
  }

  /// A camera + format that can produce landscape frames while the phone is upright.
  static func nativeLandscapeCandidate(position: AVCaptureDevice.Position) -> (AVCaptureDevice, AVCaptureDevice.Format)? {
    guard #available(iOS 26.0, *) else { return nil }
    for device in devices(position: position) {
      let formats = device.formats.filter { format in
        let ratios = format.supportedDynamicAspectRatios
        // 30 fps must be inside a supported range, or setting the frame duration raises an exception.
        let supports30fps = format.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= 30 && $0.maxFrameRate >= 30 }
        return supports30fps && (ratios.contains(.ratio9x16) || ratios.contains(.ratio16x9))
      }
      // Largest format that is still a video-sized format (≤ 4K area), so files stay manageable.
      let best = formats
        .map { ($0, CMVideoFormatDescriptionGetDimensions($0.formatDescription)) }
        .filter { Int($0.1.width) * Int($0.1.height) <= 4096 * 4096 }
        .max { Int($0.1.width) * Int($0.1.height) < Int($1.1.width) * Int($1.1.height) }
      if let best {
        return (device, best.0)
      }
    }
    return nil
  }

  /// Best preset for recording vertical video that will be cropped to 16:9.
  static func cropPreset(for device: AVCaptureDevice) -> AVCaptureSession.Preset {
    device.supportsSessionPreset(.hd4K3840x2160) ? .hd4K3840x2160 : .hd1920x1080
  }

  /// Portrait frame size (width x height, after rotation) that crop mode records at.
  static func cropSourceSize(position: AVCaptureDevice.Position) -> [String: Int]? {
    guard let device = standardDevice(position: position) else { return nil }
    let is4K = cropPreset(for: device) == .hd4K3840x2160
    return is4K ? ["width": 2160, "height": 3840] : ["width": 1080, "height": 1920]
  }

  static func describe() -> [String: Any] {
    var result: [String: Any] = [
      "nativeLandscapeFront": nativeLandscapeCandidate(position: .front) != nil,
      "nativeLandscapeBack": nativeLandscapeCandidate(position: .back) != nil,
      "hasFrontCamera": standardDevice(position: .front) != nil,
      "hasBackCamera": standardDevice(position: .back) != nil
    ]
    if let front = cropSourceSize(position: .front) {
      result["cropSourceFront"] = front
    }
    if let back = cropSourceSize(position: .back) {
      result["cropSourceBack"] = back
    }
    return result
  }
}
