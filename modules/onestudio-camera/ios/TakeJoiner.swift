import AVFoundation

/// Joins takes, in order, into one H.264 .mp4.
///
/// Every take is placed with an aspect-fill transform into the output frame:
/// - 16:9 output from a vertical take = centre crop of a 16:9 band (the "crop" strategy).
/// - 16:9 output from a landscape take = straight scale (the "native-landscape" strategy).
/// - 9:16 output from a vertical take = straight scale.
/// So the result is always the requested shape, whatever each file's metadata says.
final class TakeJoiner {
  private var exportSession: AVAssetExportSession?
  private var isCancelled = false

  func cancel() {
    isCancelled = true
    exportSession?.cancelExport()
  }

  private struct Segment {
    let start: CMTime
    /// Moves the track's pixels into upright orientation with origin at (0, 0).
    let uprightTransform: CGAffineTransform
    let uprightSize: CGSize
  }

  func join(
    takes: [URL],
    landscape: Bool,
    output: URL,
    progress: @escaping (Double) -> Void
  ) async throws -> [String: Any] {
    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      throw JoinFailedException("couldn't create a video track")
    }
    let audioTrack = composition.addMutableTrack(
      withMediaType: .audio,
      preferredTrackID: kCMPersistentTrackID_Invalid
    )

    var segments: [Segment] = []
    var cursor = CMTime.zero
    var frameRate: Float = 30

    for url in takes {
      let asset = AVURLAsset(url: url)
      guard let sourceVideo = try await asset.loadTracks(withMediaType: .video).first else {
        continue
      }
      let (range, naturalSize, transform, fps) = try await sourceVideo.load(
        .timeRange, .naturalSize, .preferredTransform, .nominalFrameRate
      )
      guard range.duration.seconds > 0.05 else { continue }

      try videoTrack.insertTimeRange(range, of: sourceVideo, at: cursor)

      if let audioTrack, let sourceAudio = try await asset.loadTracks(withMediaType: .audio).first {
        let audioRange = try await sourceAudio.load(.timeRange)
        let overlap = CMTimeRangeGetIntersection(range, otherRange: audioRange)
        if overlap.duration.seconds > 0 {
          try audioTrack.insertTimeRange(overlap, of: sourceAudio, at: cursor + (overlap.start - range.start))
        }
      }

      let rect = CGRect(origin: .zero, size: naturalSize).applying(transform)
      let upright = transform.concatenating(CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
      segments.append(Segment(
        start: cursor,
        uprightTransform: upright,
        uprightSize: CGSize(width: abs(rect.width), height: abs(rect.height))
      ))
      if segments.count == 1, fps > 0 {
        frameRate = fps
      }
      cursor = cursor + range.duration
    }

    guard let first = segments.first else {
      throw JoinFailedException("none of the takes could be read")
    }
    if let audioTrack, audioTrack.segments.isEmpty {
      composition.removeTrack(audioTrack)
    }

    let renderSize = Self.renderSize(source: first.uprightSize, landscape: landscape)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
    for segment in segments {
      let size = segment.uprightSize
      let scale = max(renderSize.width / size.width, renderSize.height / size.height)
      let offsetX = (renderSize.width - size.width * scale) / 2
      let offsetY = (renderSize.height - size.height * scale) / 2
      let placed = segment.uprightTransform
        .concatenating(CGAffineTransform(scaleX: scale, y: scale))
        .concatenating(CGAffineTransform(translationX: offsetX, y: offsetY))
      layerInstruction.setTransform(placed, at: segment.start)
    }

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: cursor)
    instruction.layerInstructions = [layerInstruction]

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    let fps = max(24, min(60, Int32(frameRate.rounded())))
    videoComposition.frameDuration = CMTime(value: 1, timescale: fps)
    videoComposition.instructions = [instruction]

    try? FileManager.default.createDirectory(
      at: output.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    try? FileManager.default.removeItem(at: output)

    guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw JoinFailedException("couldn't start the export")
    }
    export.outputURL = output
    export.outputFileType = .mp4
    export.videoComposition = videoComposition
    export.shouldOptimizeForNetworkUse = true
    exportSession = export

    if isCancelled {
      throw JoinFailedException("cancelled")
    }

    let poller = Task {
      while !Task.isCancelled {
        progress(Double(export.progress))
        try? await Task.sleep(nanoseconds: 200_000_000)
      }
    }
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      export.exportAsynchronously {
        continuation.resume()
      }
    }
    poller.cancel()

    switch export.status {
    case .completed:
      progress(1)
    case .cancelled:
      throw JoinFailedException("cancelled")
    default:
      throw JoinFailedException(export.error?.localizedDescription ?? "unknown error")
    }

    return [
      "uri": output.absoluteString,
      "width": Int(renderSize.width),
      "height": Int(renderSize.height),
      "durationMs": cursor.seconds * 1000
    ]
  }

  /// Output frame: 1920x1080 (16:9) or 1080x1920 (9:16) at most, never upscaled past the
  /// largest 16:9 / 9:16 region the source can supply. Dimensions are even for the encoder.
  static func renderSize(source: CGSize, landscape: Bool) -> CGSize {
    func even(_ value: CGFloat) -> CGFloat { CGFloat(Int(value) / 2 * 2) }
    if landscape {
      let width = even(min(1920, source.width, source.height * 16 / 9))
      return CGSize(width: width, height: even(width * 9 / 16))
    }
    let width = even(min(1080, source.width, source.height * 9 / 16))
    return CGSize(width: width, height: even(width * 16 / 9))
  }
}
