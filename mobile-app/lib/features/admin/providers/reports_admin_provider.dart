import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/admin_report.dart';
import '../services/reports_admin_service.dart';

class ReportsAdminNotifier extends AsyncNotifier<List<AdminReport>> {
  @override
  Future<List<AdminReport>> build() async {
    final service = await ref.watch(reportsAdminServiceProvider.future);
    return service.list();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final service = await ref.read(reportsAdminServiceProvider.future);
      return service.list();
    });
  }

  Future<void> updateStatus(String publicCode, String status) async {
    final service = await ref.read(reportsAdminServiceProvider.future);
    await service.updateStatus(publicCode, status);
    await refresh();
  }
}

final reportsAdminProvider =
    AsyncNotifierProvider<ReportsAdminNotifier, List<AdminReport>>(
      ReportsAdminNotifier.new,
    );
