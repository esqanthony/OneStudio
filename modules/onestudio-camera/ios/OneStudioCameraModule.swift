import AVFoundation
import ExpoModulesCore

/// Normalized rectangle (0–1) in the output frame, origin top-left.
struct OverlayRect: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
}

/// An image shown on top of the video between two times.
struct OverlayOptions: Record {
  @Field var imageUri: String = ""
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
  /// Box the image is fitted into (keeping its shape).
  @Field var rect: OverlayRect = OverlayRect()
}

/// Options for joining recorded takes into one video.
struct JoinOptions: Record {
  /// file:// URIs of the takes, in order.
  @Field var uris: [String] = []
  /// "9:16" or "16:9". Each take is centre-cropped (aspect-fill) into this frame.
  @Field var aspect: String = "9:16"
  /// Where to write the joined .mp4.
  @Field var outputUri: URL?
  /// Slides drawn into the video.
  @Field var overlays: [OverlayOptions] = []
}

public final class OneStudioCameraModule: Module {
  private var activeJoin: TakeJoiner?

  public func definition() -> ModuleDefinition {
    Name("OneStudioCamera")

    Events("onJoinProgress")

    AsyncFunction("getPermissionsAsync") { () -> [String: Bool] in
      return [
        "camera": AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
        "microphone": AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
      ]
    }

    AsyncFunction("requestPermissionsAsync") { () async -> [String: Bool] in
      let camera = await AVCaptureDevice.requestAccess(for: .video)
      let microphone = await AVCaptureDevice.requestAccess(for: .audio)
      return ["camera": camera, "microphone": microphone]
    }

    /// What this iPhone can do, so JS can pick a capture strategy before the first take.
    AsyncFunction("getCapabilitiesAsync") { () -> [String: Any] in
      return CameraCapabilities.describe()
    }

    /// Duration and display size of a video file, or nil if it can't be read
    /// (used to recover a take that was cut off when the app was killed).
    AsyncFunction("probeVideoAsync") { (uri: URL) async -> [String: Any]? in
      return await VideoProbe.probe(url: uri)
    }

    AsyncFunction("joinTakesAsync") { (options: JoinOptions) async throws -> [String: Any] in
      guard let output = options.outputUri else {
        throw InvalidArgumentException("outputUri is required")
      }
      guard !options.uris.isEmpty else {
        throw InvalidArgumentException("There are no takes to join")
      }
      let joiner = TakeJoiner()
      self.activeJoin = joiner
      defer { self.activeJoin = nil }
      let takes = options.uris.compactMap { URL(string: $0) }
      let overlays = options.overlays.compactMap { item -> TakeJoiner.Overlay? in
        guard let url = URL(string: item.imageUri), item.endMs > item.startMs else { return nil }
        return TakeJoiner.Overlay(
          imageURL: url,
          start: item.startMs / 1000,
          end: item.endMs / 1000,
          rect: CGRect(x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height)
        )
      }
      return try await joiner.join(
        takes: takes,
        landscape: options.aspect == "16:9",
        overlays: overlays,
        output: output
      ) { [weak self] progress in
        self?.sendEvent("onJoinProgress", ["progress": progress])
      }
    }

    AsyncFunction("cancelJoinAsync") {
      self.activeJoin?.cancel()
    }

    View(OneStudioCameraView.self) {
      Events("onCameraReady", "onTakeStarted", "onTakeFinished", "onCameraError")

      Prop("position") { (view: OneStudioCameraView, position: String?) in
        view.requestedPosition = position == "back" ? .back : .front
      }

      Prop("strategy") { (view: OneStudioCameraView, strategy: String?) in
        view.requestedStrategy = CaptureStrategy(rawValue: strategy ?? "") ?? .portrait
      }

      Prop("active") { (view: OneStudioCameraView, active: Bool?) in
        view.isActive = active ?? true
      }

      OnViewDidUpdateProps { (view: OneStudioCameraView) in
        view.applyConfigurationIfNeeded()
      }

      AsyncFunction("startTakeAsync") { (view: OneStudioCameraView, uri: URL, maxDurationSeconds: Double?) in
        try view.startTake(to: uri, maxDurationSeconds: maxDurationSeconds)
      }.runOnQueue(.main)

      AsyncFunction("stopTakeAsync") { (view: OneStudioCameraView) in
        view.stopTake()
      }.runOnQueue(.main)
    }
  }
}

final class CameraNotReadyException: Exception, @unchecked Sendable {
  override var reason: String { "The camera isn't ready yet" }
}

final class AlreadyRecordingException: Exception, @unchecked Sendable {
  override var reason: String { "A take is already being recorded" }
}

final class InvalidArgumentException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

final class JoinFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Couldn't join the takes: \(param)" }
}
