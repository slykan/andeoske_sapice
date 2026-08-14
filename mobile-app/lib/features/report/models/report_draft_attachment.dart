import 'dart:convert';
import 'dart:typed_data';

/// A photo picked on-device, staged for submission as a base64 `dataUrl`
/// (the exact shape `reports.php`'s `saveAttachments()` expects — not
/// multipart), so it can be included straight in the report JSON payload.
class ReportDraftAttachment {
  const ReportDraftAttachment({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;

  int get byteSize => bytes.length;

  String get dataUrl => 'data:$mimeType;base64,${base64Encode(bytes)}';

  Map<String, dynamic> toJson() => {
    'dataUrl': dataUrl,
    'fileName': fileName,
    'mimeType': mimeType,
    'byteSize': byteSize,
  };
}
