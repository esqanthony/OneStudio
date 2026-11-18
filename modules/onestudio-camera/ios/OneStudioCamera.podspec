Pod::Spec.new do |s|
  s.name           = 'OneStudioCamera'
  s.version        = '0.1.0'
  s.summary        = 'OneStudio take-based camera and take joiner (AVFoundation)'
  s.description    = 'Segmented recording with portrait, cropped-landscape and native-landscape capture, plus AVFoundation joining.'
  s.author         = 'OneStudio'
  s.homepage       = 'https://github.com/esqanthony/OneStudio'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
