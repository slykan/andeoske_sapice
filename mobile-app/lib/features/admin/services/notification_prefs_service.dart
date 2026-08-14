import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

class NotificationPrefsException implements Exception {
  NotificationPrefsException(this.message);
  final String message;

  @override
  String toString() => message;
}

class NotificationPrefs {
  const NotificationPrefs({required this.channel, required this.editable});
  final String channel;
  final bool editable;
}

/// Talks to `public/api/notification-prefs.php`. Only `EMAIL` is currently
/// accepted by the backend — `PUSH`/`BOTH` are rejected with a clear error
/// until FCM delivery is built in a follow-up round, so the UI shows those
/// as disabled rather than lying about what will happen.
class NotificationPrefsService {
  NotificationPrefsService(this._client);

  final ApiClient _client;

  Future<NotificationPrefs> fetch() async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/notification-prefs.php',
    );
    final data = response.data ?? const {};
    return NotificationPrefs(
      channel: data['notifyChannel'] as String? ?? 'EMAIL',
      editable: data['editable'] as bool? ?? true,
    );
  }

  Future<void> update(String channel) async {
    final response = await _client.dio.patch<Map<String, dynamic>>(
      '/notification-prefs.php',
      data: {'notifyChannel': channel},
    );
    if (response.statusCode != 200) {
      final message =
          response.data?['error'] as String? ?? 'Spremanje nije uspjelo.';
      throw NotificationPrefsException(message);
    }
  }
}

final notificationPrefsServiceProvider =
    FutureProvider<NotificationPrefsService>((ref) async {
      final client = await ref.watch(apiClientProvider.future);
      return NotificationPrefsService(client);
    });
