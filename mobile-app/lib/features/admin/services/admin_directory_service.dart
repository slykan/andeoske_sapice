import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../models/admin_directory.dart';

/// Talks to `public/api/admin.php` GET, which already returns regions,
/// organizations and users scoped by the logged-in role (ADMIN sees
/// everything; VOLUNTEER/ORGANIZATION only their own region).
class AdminDirectoryService {
  AdminDirectoryService(this._client);

  final ApiClient _client;

  Future<AdminDirectory> fetch() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/admin.php');
    return AdminDirectory.fromJson(response.data ?? const {});
  }
}

final adminDirectoryServiceProvider = FutureProvider<AdminDirectoryService>((
  ref,
) async {
  final client = await ref.watch(apiClientProvider.future);
  return AdminDirectoryService(client);
});

final adminDirectoryProvider = FutureProvider.autoDispose<AdminDirectory>((
  ref,
) async {
  final service = await ref.watch(adminDirectoryServiceProvider.future);
  return service.fetch();
});
