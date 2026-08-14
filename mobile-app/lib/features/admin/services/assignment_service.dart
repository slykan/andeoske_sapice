import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

class AssignmentException implements Exception {
  AssignmentException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Talks to `public/api/admin.php` PATCH — assigning a report to a
/// region/organization/volunteer (and saving its comment), and triggering
/// the corresponding notification emails. Mirrors what the web admin panel
/// already does; scoping (who is allowed to touch which report) is enforced
/// server-side by `requireReportInScope()`.
class AssignmentService {
  AssignmentService(this._client);

  final ApiClient _client;

  Future<void> assign({
    required String reportId,
    required String status,
    String? regionId,
    String? organizationId,
    String? assignedToId,
    String? comment,
  }) async {
    await _patch({
      'type': 'assignment',
      'reportId': reportId,
      'status': status,
      'regionId': regionId,
      'organizationId': organizationId,
      'assignedToId': assignedToId,
      'comment': comment,
    });
  }

  Future<void> notifyVolunteer(String reportId) {
    return _patch({'type': 'notifyVolunteer', 'reportId': reportId});
  }

  Future<void> notifyRegion(String reportId) {
    return _patch({'type': 'notifyRegion', 'reportId': reportId});
  }

  Future<void> notifyGroup(String reportId) {
    return _patch({'type': 'notifyGroup', 'reportId': reportId});
  }

  Future<void> _patch(Map<String, dynamic> data) async {
    final response = await _client.dio.patch<Map<String, dynamic>>(
      '/admin.php',
      data: data,
    );
    if (response.statusCode != 200) {
      final message =
          response.data?['error'] as String? ?? 'Radnja nije uspjela.';
      throw AssignmentException(message);
    }
  }
}

final assignmentServiceProvider = FutureProvider<AssignmentService>((
  ref,
) async {
  final client = await ref.watch(apiClientProvider.future);
  return AssignmentService(client);
});
