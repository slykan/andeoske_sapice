import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/session_storage.dart';
import '../models/auth_user.dart';
import '../services/auth_service.dart';

/// Holds the current admin/volunteer identity, or null when signed out.
/// `build()` restores the session on app start by asking `session.php`
/// whether the persisted cookie is still valid.
class AuthNotifier extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() async {
    final storage = ref.read(sessionStorageProvider);
    final rememberMe = await storage.readRememberMe();
    final service = await ref.watch(authServiceProvider.future);

    if (!rememberMe) {
      // "Zapamti me" was unchecked at last login — don't restore the
      // session even though the cookie may still be valid; forget it.
      await service.logout();
      await storage.clearCachedUser();
      return null;
    }

    final user = await service.whoAmI();
    if (user != null) {
      await storage.saveCachedUser(username: user.username, role: user.role);
    }
    return user;
  }

  Future<void> login(
    String username,
    String password, {
    required bool rememberMe,
  }) async {
    state = const AsyncLoading();
    final service = await ref.read(authServiceProvider.future);
    final storage = ref.read(sessionStorageProvider);
    state = await AsyncValue.guard(() async {
      final user = await service.login(username, password);
      await storage.saveRememberMe(rememberMe);
      await storage.saveCachedUser(username: user.username, role: user.role);
      return user;
    });
  }

  Future<void> logout() async {
    final service = await ref.read(authServiceProvider.future);
    await service.logout();
    await ref.read(sessionStorageProvider).clearCachedUser();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthUser?>(
  AuthNotifier.new,
);
