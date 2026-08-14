import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../models/report_form_state.dart';

class ReportSubmissionException implements Exception {
  ReportSubmissionException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Posts to `public/api/reports.php`, matching the exact JSON shape the web
/// form already sends (see `createReport()`/`validateSubmissionSecurity()`),
/// so the endpoint needed zero changes for the mobile client.
class ReportsService {
  ReportsService(this._client);

  final ApiClient _client;

  Future<String> submit(ReportFormState form) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/reports.php',
      data: {
        'category': form.category,
        'animal': form.animal.trim(),
        'description': form.description.trim(),
        'place': form.place.trim(),
        'urgency': form.urgency,
        'anonymous': form.anonymous,
        'wantsResolutionNotice': form.wantsResolutionNotice,
        'reporterEmail': form.reporterEmail.trim(),
        'reporterPhone': form.reporterPhone.trim(),
        'latitude': form.latitude,
        'longitude': form.longitude,
        'flags': form.flags.toList(),
        'attachments': form.attachments.map((a) => a.toJson()).toList(),
        // Anti-spam fields required by validateSubmissionSecurity(): a
        // honeypot that must stay empty, and proof the form was open long
        // enough to be filled by a human.
        'website': '',
        'formStartedAt': form.formStartedAt,
      },
    );

    final data = response.data ?? const {};
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ReportSubmissionException(
        (data['error'] as String?) ?? 'Slanje prijave nije uspjelo.',
      );
    }

    final report = data['report'] as Map<String, dynamic>?;
    final publicCode = report?['id'] as String?;
    if (publicCode == null) {
      throw ReportSubmissionException('Neočekivan odgovor poslužitelja.');
    }
    return publicCode;
  }
}

final reportsServiceProvider = FutureProvider<ReportsService>((ref) async {
  final client = await ref.watch(apiClientProvider.future);
  return ReportsService(client);
});
