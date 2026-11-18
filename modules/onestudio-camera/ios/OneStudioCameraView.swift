import AVFoundation
import ExpoModulesCore
import UIKit

/// Live camera preview that records one take at a time into separate files.
///
/// The UI is locked to portrait and the phone is held upright for every strategy:
/// - portrait:          9:16 recording.
/// - native-landscape:  iOS 26 dynamic aspect ratio on a square-sensor camera, rotated so the
///                      file is 16:9 landscape while the phone stays upright.
/// - crop:              vertical recording (4K when available); the joiner cuts out 16:9.
final class OneStudioCameraView: ExpoView, AVCaptureFileOutputRecordingDelegate {
  let onCameraReady = EventDispatcher()
  let onTakeStarted = EventDispatcher()
  let onTakeFinished = EventDispatcher()
  let onCameraError = EventDispatcher()

  // Desired state, set from props on the main thread.
  var requestedPosition: AVCaptureDevice.Position = .front
  var requestedStrategy: CaptureStrategy = .portrait
  var isActive = true

  private let session = AVCaptureSession()
  private let movieOutput = AVCaptureMovieFileOutput()
  private let sessionQueue = DispatchQueue(label: "onestudio.camera.session")

  // Only touched on sessionQueue.
  private var videoInput: AVCaptureDeviceInput?
  private var audioInput: AVCaptureDeviceInput?
  private var appliedPosition: AVCaptureDevice.Position?
  private var appliedStrategy: CaptureStrategy?
  private var observers: [NSObjectProtocol] = []

  // Read on the main thread to reject calls early.
  private var isConfigured = false
  private var isRecordingTake = false

  override class var layerClass: AnyClass {
    AVCaptureVideoPreviewLayer.self
  }

  private var previewLayer: AVCaptureVideoPreviewLayer {
    // swiftlint:disable:next force_cast
    layer as! AVCaptureVideoPreviewLayer
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    previewLayer.session = session
    previewLayer.videoGravity = .resizeAspectFill
    previewLayer.needsDisplayOnBoundsChange = true
    observeSession()
  }

  deinit {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
  }

  override func removeFromSuperview() {
    super.removeFromSuperview()
    let session = self.session
    let movieOutput = self.movieOutput
    sessionQueue.async {
      if movieOutput.isRecording {
        movieOutput.stopRecording()
      }
      if session.isRunning {
        session.stopRunning()
      }
    }
  }

  // MARK: - Configuration

  func applyConfigurationIfNeeded() {
    let position = requestedPosition
    let strategy = requestedStrategy
    let active = isActive
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if active {
        if position != self.appliedPosition || strategy != self.appliedStrategy {
          // Never reconfigure while a take is being written.
          if !self.movieOutput.isRecording {
            self.configure(position: position, strategy: strategy)
          }
        }
        if !self.session.isRunning {
          self.session.startRunning()
        }
      } else {
        if self.movieOutput.isRecording {
          self.movieOutput.stopRecording()
        }
        if self.session.isRunning {
          self.session.stopRunning()
        }
      }
    }
  }

  /// Runs on sessionQueue.
  private func configure(position: AVCaptureDevice.Position, strategy: CaptureStrategy) {
    session.beginConfiguration()

    if let videoInput {
      session.removeInput(videoInput)
      self.videoInput = nil
    }

    var effective = strategy
    var device: AVCaptureDevice?
    var landscapeFormat: AVCaptureDevice.Format?

    if strategy == .nativeLandscape, let candidate = CameraCapabilities.nativeLandscapeCandidate(position: position) {
      device = candidate.0
      landscapeFormat = candidate.1
    } else {
      if strategy == .nativeLandscape {
        effective = .crop
      }
      device = CameraCapabilities.standardDevice(position: position)
    }

    guard let device, let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else {
      session.commitConfiguration()
      emitError("No camera is available for this mode.")
      return
    }

    if landscapeFormat != nil {
      session.sessionPreset = .inputPriority
    }
    session.addInput(input)
    videoInput = input

    if let landscapeFormat {
      do {
        try device.lockForConfiguration()
        device.activeFormat = landscapeFormat
        let thirtyFps = CMTime(value: 1, timescale: 30)
        device.activeVideoMinFrameDuration = thirtyFps
        device.activeVideoMaxFrameDuration = thirtyFps
        device.unlockForConfiguration()
      } catch {
        emitError("Couldn't configure the camera: \(error.localizedDescription)")
      }
    } else {
      let preset: AVCaptureSession.Preset = effective == .crop
        ? CameraCapabilities.cropPreset(for: device)
        : .hd1920x1080
      session.sessionPreset = session.canSetSessionPreset(preset) ? preset : .high
    }

    if audioInput == nil,
       AVCaptureDevice.authorizationStatus(for: .audio) == .authorized,
       let mic = AVCaptureDevice.default(for: .audio),
       let micInput = try? AVCaptureDeviceInput(device: mic),
       session.canAddInput(micInput) {
      session.addInput(micInput)
      audioInput = micInput
    }

    if !session.outputs.contains(movieOutput), session.canAddOutput(movieOutput) {
      session.addOutput(movieOutput)
    }

    if let connection = movieOutput.connection(with: .video) {
      rotateToPortrait(connection)
      if connection.isVideoMirroringSupported {
        // Preview is mirrored like a mirror; the saved file is not, so on-screen text reads correctly.
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = false
      }
      if connection.isVideoStabilizationSupported {
        connection.preferredVideoStabilizationMode = .auto
      }
    }

    session.commitConfiguration()

    var size = expectedPortraitSize(device: device)
    if effective == .nativeLandscape {
      if let landscapeSize = applyLandscapeAspectRatio(device: device) {
        size = landscapeSize
      } else {
        // The camera didn't give landscape frames: fall back to cropping, and tell JS.
        appliedPosition = position
        appliedStrategy = .crop
        configure(position: position, strategy: .crop)
        return
      }
    }

    appliedPosition = position
    appliedStrategy = effective

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if let connection = self.previewLayer.connection {
        self.rotateToPortrait(connection)
      }
      self.isConfigured = true
      self.onCameraReady([
        "strategy": effective.rawValue,
        "position": position == .back ? "back" : "front",
        "width": Int(size.width),
        "height": Int(size.height)
      ])
    }
  }

  private func rotateToPortrait(_ connection: AVCaptureConnection) {
    if #available(iOS 17.0, *) {
      if connection.isVideoRotationAngleSupported(90) {
        connection.videoRotationAngle = 90
      }
    } else if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
  }

  private func expectedPortraitSize(device: AVCaptureDevice) -> CGSize {
    switch session.sessionPreset {
    case .hd4K3840x2160: return CGSize(width: 2160, height: 3840)
    case .hd1920x1080: return CGSize(width: 1080, height: 1920)
    default:
      let dims = CMVideoFormatDescriptionGetDimensions(device.activeFormat.formatDescription)
      return CGSize(width: Int(dims.height), height: Int(dims.width))
    }
  }

  /// Picks the dynamic aspect ratio that yields landscape frames once rotated for an upright phone.
  /// Returns the resulting landscape size, or nil if the device can't do it.
  private func applyLandscapeAspectRatio(device: AVCaptureDevice) -> CGSize? {
    guard #available(iOS 26.0, *) else { return nil }
    let supported = device.activeFormat.supportedDynamicAspectRatios
    // Sensor buffers are landscape-native; with a 90° rotation for portrait, a buffer that is
    // taller than it is wide becomes a landscape frame. Try both and keep whichever works.
    for ratio in [AVCaptureDevice.AspectRatio.ratio9x16, .ratio16x9] where supported.contains(ratio) {
      do {
        try device.lockForConfiguration()
      } catch {
        return nil
      }
      let done = DispatchSemaphore(value: 0)
      device.setDynamicAspectRatio(ratio) { _, _ in
        done.signal()
      }
      _ = done.wait(timeout: .now() + 2)
      device.unlockForConfiguration()

      let dims = device.dynamicDimensions
      if dims.height > dims.width {
        // Rotated 90° for the upright phone, so width and height swap.
        return CGSize(width: Int(dims.height), height: Int(dims.width))
      }
    }
    return nil
  }

  // MARK: - Recording

  func startTake(to url: URL, maxDurationSeconds: Double?) throws {
    guard isConfigured else {
      throw CameraNotReadyException()
    }
    guard !isRecordingTake else {
      throw AlreadyRecordingException()
    }
    isRecordingTake = true
    sessionQueue.async { [weak self] in
      guard let self else { return }
      let fileManager = FileManager.default
      try? fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try? fileManager.removeItem(at: url)

      if let maxDurationSeconds, maxDurationSeconds > 0 {
        self.movieOutput.maxRecordedDuration = CMTime(seconds: maxDurationSeconds, preferredTimescale: 600)
      } else {
        self.movieOutput.maxRecordedDuration = .invalid
      }
      // Write a playable fragment every 2s, so a take survives the app being killed.
      self.movieOutput.movieFragmentInterval = CMTime(seconds: 2, preferredTimescale: 600)
      self.movieOutput.startRecording(to: url, recordingDelegate: self)
    }
  }

  func stopTake() {
    sessionQueue.async { [weak self] in
      guard let self, self.movieOutput.isRecording else { return }
      self.movieOutput.stopRecording()
    }
  }

  func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
    DispatchQueue.main.async { [weak self] in
      self?.onTakeStarted(["uri": fileURL.absoluteString])
    }
  }

  func fileOutput(
    _ output: AVCaptureFileOutput,
    didFinishRecordingTo outputFileURL: URL,
    from connections: [AVCaptureConnection],
    error: Error?
  ) {
    let nsError = error as NSError?
    let finishedCleanly = error == nil
      || (nsError?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool) == true
    var reason = "stopped"
    if let nsError {
      reason = nsError.code == AVError.Code.maximumDurationReached.rawValue ? "maxDuration" : "interrupted"
    }

    Task { [weak self] in
      let info = await VideoProbe.probe(url: outputFileURL)
      await MainActor.run {
        guard let self else { return }
        self.isRecordingTake = false
        var payload: [String: Any] = [
          "uri": outputFileURL.absoluteString,
          "success": finishedCleanly && info != nil,
          "reason": reason
        ]
        if let info {
          payload.merge(info) { _, new in new }
        }
        if let nsError, !finishedCleanly {
          payload["error"] = nsError.localizedDescription
        }
        self.onTakeFinished(payload)
      }
    }
  }

  // MARK: - Session events

  private func observeSession() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(
      forName: AVCaptureSession.runtimeErrorNotification,
      object: session,
      queue: nil
    ) { [weak self] note in
      guard let self else { return }
      let error = note.userInfo?[AVCaptureSessionErrorKey] as? AVError
      self.emitError("Camera error: \(error?.localizedDescription ?? "unknown")")
      if error?.code == .mediaServicesWereReset {
        self.sessionQueue.async {
          if self.isActive && !self.session.isRunning {
            self.session.startRunning()
          }
        }
      }
    })
  }

  private func emitError(_ message: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onCameraError(["message": message])
    }
  }
}

enum VideoProbe {
  /// Duration (ms) and display size of a video file, or nil if it can't be read.
  static func probe(url: URL) async -> [String: Any]? {
    let asset = AVURLAsset(url: url)
    do {
      let duration = try await asset.load(.duration)
      guard duration.isNumeric, duration.seconds > 0 else { return nil }
      guard let track = try await asset.loadTracks(withMediaType: .video).first else { return nil }
      let (size, transform) = try await track.load(.naturalSize, .preferredTransform)
      let rect = CGRect(origin: .zero, size: size).applying(transform)
      return [
        "durationMs": duration.seconds * 1000,
        "width": Int(abs(rect.width).rounded()),
        "height": Int(abs(rect.height).rounded())
      ]
    } catch {
      return nil
    }
  }
}
