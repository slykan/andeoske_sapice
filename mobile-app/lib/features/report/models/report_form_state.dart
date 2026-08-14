import 'report_draft_attachment.dart';

class ReportFormState {
  ReportFormState({
    required this.formStartedAt,
    this.category,
    this.animal = '',
    this.description = '',
    this.place = '',
    this.urgency = 'Srednja',
    this.anonymous = false,
    this.wantsResolutionNotice = false,
    this.reporterEmail = '',
    this.reporterPhone = '',
    this.latitude,
    this.longitude,
    this.flags = const {},
    this.attachments = const [],
    this.isSubmitting = false,
    this.errorMessage,
    this.publicCode,
  });

  final int formStartedAt;
  final String? category;
  final String animal;
  final String description;
  final String place;
  final String urgency;
  final bool anonymous;
  final bool wantsResolutionNotice;
  final String reporterEmail;
  final String reporterPhone;
  final double? latitude;
  final double? longitude;
  final Set<String> flags;
  final List<ReportDraftAttachment> attachments;
  final bool isSubmitting;
  final String? errorMessage;
  final String? publicCode;

  bool get hasLocation => latitude != null && longitude != null;
  bool get isSubmitted => publicCode != null;

  ReportFormState copyWith({
    String? category,
    String? animal,
    String? description,
    String? place,
    String? urgency,
    bool? anonymous,
    bool? wantsResolutionNotice,
    String? reporterEmail,
    String? reporterPhone,
    double? latitude,
    double? longitude,
    Set<String>? flags,
    List<ReportDraftAttachment>? attachments,
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
    String? publicCode,
  }) {
    return ReportFormState(
      formStartedAt: formStartedAt,
      category: category ?? this.category,
      animal: animal ?? this.animal,
      description: description ?? this.description,
      place: place ?? this.place,
      urgency: urgency ?? this.urgency,
      anonymous: anonymous ?? this.anonymous,
      wantsResolutionNotice:
          wantsResolutionNotice ?? this.wantsResolutionNotice,
      reporterEmail: reporterEmail ?? this.reporterEmail,
      reporterPhone: reporterPhone ?? this.reporterPhone,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      flags: flags ?? this.flags,
      attachments: attachments ?? this.attachments,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      publicCode: publicCode ?? this.publicCode,
    );
  }
}
