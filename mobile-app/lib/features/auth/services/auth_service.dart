import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../models/auth_user.dart';

class AuthException implements Exception {
  AuthException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Talks to `public/api/session.php`. Authentication itself is the PHP
/// session cookie (`andeoske_admin`), persisted by [ApiClient]'s cookie jar
/// — this service just triggers the login/logout requests and reads back
/// the resulting role.
class AuthService {
  AuthService(this._client);

  final ApiClient _client;

  Future<AuthUser> login(String username, String password) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/session.php',
      data: {'username': username, 'password': password},
    );

    if (response.statusCode != 200) {
      final message =
          response.data?['error'] as String? ?? 'Prijava nije uspjela.';
      throw AuthException(message);
    }

    // The POST response doesn't echo back the username, so fetch it via GET.
    final me = await whoAmI();
    if (me == null) {
      throw AuthException('Prijava nije uspjela.');
    }
    return AuthUser(username: username, role: me.role);
  }

  Future<AuthUser?> whoAmI() async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/session.php',
    );
    final data = response.data ?? const {};
    if (data['isAdmin'] != true) {
      return null;
    }
    return AuthUser.fromJson(data);
  }

  Future<void> logout() async {
    await _client.dio.delete<Map<String, dynamic>>('/session.php');
  }
}

final authServiceProvider = FutureProvider<AuthService>((ref) async {
  final client = await ref.watch(apiClientProvider.future);
  return AuthService(client);
});
