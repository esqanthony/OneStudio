import AVFoundation
import QuartzCore
import UIKit

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

  /// A slide image shown from `start` to `end` seconds, fitted into `rect` (normalized, top-left origin).
  struct Overlay {
    let imageURL: URL
    let start: Double
    let end: Double
    let rect: CGRect
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
    overlays: [Overlay] = [],
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
    if !overlays.isEmpty {
      videoComposition.animationTool = Self.overlayTool(overlays: overlays, renderSize: renderSize)
    }

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

  /// Draws slides over the video with Core Animation: one layer per slide segment, visible only
  /// during its time range.
  static func overlayTool(overlays: [Overlay], renderSize: CGSize) -> AVVideoCompositionCoreAnimationTool {
    let frame = CGRect(origin: .zero, size: renderSize)
    let parent = CALayer()
    parent.frame = frame
    // Top-left origin, matching the normalized rects from JS.
    parent.isGeometryFlipped = true
    let videoLayer = CALayer()
    videoLayer.frame = frame
    parent.addSublayer(videoLayer)

    var images: [URL: CGImage] = [:]
    for overlay in overlays {
      let image: CGImage
      if let cached = images[overlay.imageURL] {
        image = cached
      } else if let loaded = loadImage(url: overlay.imageURL, maxDimension: max(renderSize.width, renderSize.height)) {
        images[overlay.imageURL] = loaded
        image = loaded
      } else {
        continue
      }

      let box = CGRect(
        x: overlay.rect.minX * renderSize.width,
        y: overlay.rect.minY * renderSize.height,
        width: overlay.rect.width * renderSize.width,
        height: overlay.rect.height * renderSize.height
      )
      let fitted = aspectFit(CGSize(width: image.width, height: image.height), in: box)

      let layer = CALayer()
      layer.frame = fitted
      layer.contents = image
      layer.contentsGravity = .resize
      layer.cornerRadius = min(fitted.width, fitted.height) * 0.04
      layer.masksToBounds = true
      layer.opacity = 0

      let show = CABasicAnimation(keyPath: "opacity")
      show.fromValue = 1
      show.toValue = 1
      // A beginTime of 0 means "now" to Core Animation; AVFoundation needs this constant instead.
      show.beginTime = overlay.start <= 0 ? AVCoreAnimationBeginTimeAtZero : overlay.start
      show.duration = overlay.end - overlay.start
      show.isRemovedOnCompletion = false
      layer.add(show, forKey: "visible")
      parent.addSublayer(layer)
    }

    return AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)
  }

  /// Loads an image upright (photos can carry an EXIF rotation that CGImage ignores), scaled down
  /// to at most `maxDimension` pixels.
  static func loadImage(url: URL, maxDimension: CGFloat) -> CGImage? {
    guard let image = UIImage(contentsOfFile: url.path), image.size.width > 0, image.size.height > 0 else {
      return nil
    }
    let scale = min(1, maxDimension / max(image.size.width, image.size.height))
    let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }.cgImage
  }

  static func aspectFit(_ size: CGSize, in box: CGRect) -> CGRect {
    guard size.width > 0, size.height > 0 else { return box }
    let scale = min(box.width / size.width, box.height / size.height)
    let fitted = CGSize(width: size.width * scale, height: size.height * scale)
    return CGRect(
      x: box.midX - fitted.width / 2,
      y: box.midY - fitted.height / 2,
      width: fitted.width,
      height: fitted.height
    )
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
