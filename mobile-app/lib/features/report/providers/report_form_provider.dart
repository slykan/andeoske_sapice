import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/report_draft_attachment.dart';
import '../models/report_form_state.dart';
import '../services/reports_service.dart';

const maxReportAttachments = 6;

class ReportFormNotifier extends Notifier<ReportFormState> {
  @override
  ReportFormState build() {
    return ReportFormState(
      formStartedAt: DateTime.now().millisecondsSinceEpoch,
    );
  }

  void setCategory(String category) {
    // Changing category invalidates any previously selected subcategory
    // flags, since they belong to the old category.
    state = state.copyWith(category: category, flags: <String>{});
  }

  void toggleFlag(String flag) {
    final next = Set<String>.from(state.flags);
    if (!next.remove(flag)) {
      next.add(flag);
    }
    state = state.copyWith(flags: next);
  }

  void setAnimal(String value) => state = state.copyWith(animal: value);
  void setDescription(String value) =>
      state = state.copyWith(description: value);
  void setUrgency(String value) => state = state.copyWith(urgency: value);
  void setAnonymous(bool value) => state = state.copyWith(anonymous: value);
  void setWantsResolutionNotice(bool value) =>
      state = state.copyWith(wantsResolutionNotice: value);
  void setReporterEmail(String value) =>
      state = state.copyWith(reporterEmail: value);
  void setReporterPhone(String value) =>
      state = state.copyWith(reporterPhone: value);

  void setPlace(String value) => state = state.copyWith(place: value);

  void setGpsPin({required double latitude, required double longitude}) {
    state = state.copyWith(latitude: latitude, longitude: longitude);
  }

  bool addAttachment(ReportDraftAttachment attachment) {
    if (state.attachments.length >= maxReportAttachments) return false;
    state = state.copyWith(attachments: [...state.attachments, attachment]);
    return true;
  }

  void removeAttachmentAt(int index) {
    final next = List<ReportDraftAttachment>.from(state.attachments)
      ..removeAt(index);
    state = state.copyWith(attachments: next);
  }

  Future<bool> submit() async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final service = await ref.read(reportsServiceProvider.future);
      final publicCode = await service.submit(state);
      state = state.copyWith(isSubmitting: false, publicCode: publicCode);
      return true;
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: error.toString(),
      );
      return false;
    }
  }
}

final reportFormProvider =
    NotifierProvider<ReportFormNotifier, ReportFormState>(
      ReportFormNotifier.new,
    );
