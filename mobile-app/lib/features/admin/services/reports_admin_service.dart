import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../models/admin_report.dart';

class ReportsAdminException implements Exception {
  ReportsAdminException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Talks to `public/api/reports.php` GET/PATCH, role-scoped server-side by
/// the session cookie (`currentScope()` in the PHP): admins see everything,
/// volunteers only their assigned reports, organizations only their region.
class ReportsAdminService {
  ReportsAdminService(this._client);

  final ApiClient _client;

  Future<List<AdminReport>> list() async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports.php',
    );
    if (response.statusCode == 401) {
      throw ReportsAdminException('Prijava je istekla, prijavi se ponovno.');
    }
    final reports = (response.data?['reports'] as List? ?? const [])
        .map((r) => AdminReport.fromJson(r as Map<String, dynamic>))
        .toList();
    return reports;
  }

  Future<void> updateStatus(String publicCode, String status) async {
    final response = await _client.dio.patch<Map<String, dynamic>>(
      '/reports.php',
      data: {'id': publicCode, 'status': status},
    );
    if (response.statusCode != 200) {
      final message =
          response.data?['error'] as String? ??
          'Ažuriranje statusa nije uspjelo.';
      throw ReportsAdminException(message);
    }
  }
}

final reportsAdminServiceProvider = FutureProvider<ReportsAdminService>((
  ref,
) async {
  final client = await ref.watch(apiClientProvider.future);
  return ReportsAdminService(client);
});
