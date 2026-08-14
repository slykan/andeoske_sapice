import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'features/admin/screens/admin_guard.dart';
import 'features/admin/screens/notification_prefs_screen.dart';
import 'features/admin/screens/report_detail_screen.dart';
import 'features/admin/screens/reports_list_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/report/models/report_draft_attachment.dart';
import 'features/report/screens/new_report_screen.dart';
import 'features/report/screens/report_success_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
    GoRoute(
      path: '/prijava',
      builder: (context, state) => NewReportScreen(
        recoveredPhoto: state.extra as ReportDraftAttachment?,
      ),
    ),
    GoRoute(
      path: '/prijava-uspjesna',
      builder: (context, state) =>
          ReportSuccessScreen(publicCode: state.extra as String),
    ),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminGuard(child: ReportsListScreen()),
    ),
    GoRoute(
      path: '/admin/prijava/:id',
      builder: (context, state) => AdminGuard(
        child: ReportDetailScreen(publicCode: state.pathParameters['id']!),
      ),
    ),
    GoRoute(
      path: '/admin/postavke',
      builder: (context, state) =>
          const AdminGuard(child: NotificationPrefsScreen()),
    ),
  ],
);

class AndeoskeSapiceApp extends StatelessWidget {
  const AndeoskeSapiceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Anđeoske šapice',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepOrange),
      ),
      routerConfig: appRouter,
    );
  }
}
