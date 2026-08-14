class ReportAttachmentInfo {
  const ReportAttachmentInfo({
    required this.url,
    required this.fileName,
    required this.mimeType,
    required this.kind,
  });

  factory ReportAttachmentInfo.fromJson(Map<String, dynamic> json) {
    return ReportAttachmentInfo(
      url: json['url'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? '',
      kind: json['kind'] as String? ?? 'PHOTO',
    );
  }

  final String url;
  final String fileName;
  final String mimeType;
  final String kind;

  bool get isPhoto => kind == 'PHOTO';
}

/// A row from `ReportNotification` (email log), as returned alongside each
/// report by `listReports()`.
class ReportNotificationInfo {
  const ReportNotificationInfo({
    required this.recipientName,
    required this.recipientEmail,
    required this.status,
    required this.subject,
    this.responseStatus,
    this.respondedAt,
    this.createdAt,
  });

  factory ReportNotificationInfo.fromJson(Map<String, dynamic> json) {
    return ReportNotificationInfo(
      recipientName: json['recipientName'] as String? ?? '',
      recipientEmail: json['recipientEmail'] as String? ?? '',
      status: json['status'] as String? ?? 'SENT',
      subject: json['subject'] as String? ?? '',
      responseStatus: json['responseStatus'] as String?,
      respondedAt: json['respondedAt'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }

  final String recipientName;
  final String recipientEmail;
  final String status;
  final String subject;
  final String? responseStatus;
  final String? respondedAt;
  final String? createdAt;
}

/// A row from `ReportStatusHistory` (audit log), as returned alongside each
/// report by `listReports()`.
class ReportStatusHistoryInfo {
  const ReportStatusHistoryInfo({
    required this.toStatus,
    required this.action,
    this.fromStatus,
    this.note,
    this.changedByName,
    this.changedByEmail,
    this.createdAt,
  });

  factory ReportStatusHistoryInfo.fromJson(Map<String, dynamic> json) {
    return ReportStatusHistoryInfo(
      fromStatus: json['fromStatus'] as String?,
      toStatus: json['toStatus'] as String? ?? '',
      action: json['action'] as String? ?? 'STATUS_CHANGED',
      note: json['note'] as String?,
      changedByName: json['changedByName'] as String?,
      changedByEmail: json['changedByEmail'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }

  final String? fromStatus;
  final String toStatus;
  final String action;
  final String? note;
  final String? changedByName;
  final String? changedByEmail;
  final String? createdAt;
}

/// Mirrors `reportFromRow()` in `public/api/reports.php` — the shape
/// returned by both `listReports()` (GET) and used by `updateStatus()`
/// (PATCH, keyed by `id` == `publicCode`).
class AdminReport {
  const AdminReport({
    required this.id,
    required this.category,
    required this.place,
    required this.urgency,
    required this.status,
    required this.animal,
    required this.description,
    required this.reporterEmail,
    required this.reporterPhone,
    required this.wantsResolutionNotice,
    required this.flags,
    required this.anonymous,
    required this.attachments,
    required this.notifications,
    required this.statusHistory,
    this.latitude,
    this.longitude,
    this.comment,
    this.regionId,
    this.regionName,
    this.assignedToId,
    this.assignedToName,
    this.organizationId,
    this.organizationName,
  });

  factory AdminReport.fromJson(Map<String, dynamic> json) {
    return AdminReport(
      id: json['id'] as String? ?? '',
      category: json['category'] as String? ?? '',
      place: json['place'] as String? ?? '',
      urgency: json['urgency'] as String? ?? 'Srednja',
      status: json['status'] as String? ?? 'Zaprimljeno',
      animal: json['animal'] as String? ?? '',
      description: json['description'] as String? ?? '',
      reporterEmail: json['reporterEmail'] as String? ?? '',
      reporterPhone: json['reporterPhone'] as String? ?? '',
      wantsResolutionNotice: json['wantsResolutionNotice'] as bool? ?? false,
      flags: (json['flags'] as List? ?? const []).cast<String>(),
      anonymous: json['anonymous'] as bool? ?? false,
      attachments: (json['attachments'] as List? ?? const [])
          .map((a) => ReportAttachmentInfo.fromJson(a as Map<String, dynamic>))
          .toList(),
      notifications: (json['notifications'] as List? ?? const [])
          .map(
            (n) => ReportNotificationInfo.fromJson(n as Map<String, dynamic>),
          )
          .toList(),
      statusHistory: (json['statusHistory'] as List? ?? const [])
          .map(
            (h) => ReportStatusHistoryInfo.fromJson(h as Map<String, dynamic>),
          )
          .toList(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      comment: json['comment'] as String?,
      regionId: json['regionId'] as String?,
      regionName: json['regionName'] as String?,
      assignedToId: json['assignedToId'] as String?,
      assignedToName: json['assignedToName'] as String?,
      organizationId: json['organizationId'] as String?,
      organizationName: json['organizationName'] as String?,
    );
  }

  final String id;
  final String category;
  final String place;
  final String urgency;
  final String status;
  final String animal;
  final String description;
  final String reporterEmail;
  final String reporterPhone;
  final bool wantsResolutionNotice;
  final List<String> flags;
  final bool anonymous;
  final List<ReportAttachmentInfo> attachments;
  final List<ReportNotificationInfo> notifications;
  final List<ReportStatusHistoryInfo> statusHistory;
  final double? latitude;
  final double? longitude;
  final String? comment;
  final String? regionId;
  final String? regionName;
  final String? assignedToId;
  final String? assignedToName;
  final String? organizationId;
  final String? organizationName;
}

const reportStatusOptions = [
  'Zaprimljeno',
  'U provjeri',
  'Dodijeljeno',
  'Proslijeđeno',
  'U tijeku',
  'Zaključeno',
];
