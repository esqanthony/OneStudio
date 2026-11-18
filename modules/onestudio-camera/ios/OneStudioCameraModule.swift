import AVFoundation
import ExpoModulesCore

/// Options for joining recorded takes into one video.
struct JoinOptions: Record {
  /// file:// URIs of the takes, in order.
  @Field var uris: [String] = []
  /// "9:16" or "16:9". Each take is centre-cropped (aspect-fill) into this frame.
  @Field var aspect: String = "9:16"
  /// Where to write the joined .mp4.
  @Field var outputUri: URL?
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
      return try await joiner.join(
        takes: takes,
        landscape: options.aspect == "16:9",
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
