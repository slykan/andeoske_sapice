import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// Base URL for the Anđeoske šapice PHP API (`public/api/*.php`).
const String apiBaseUrl = 'https://andeoske-sapice.app/api';

/// Site origin (no `/api` suffix), used to resolve attachment URLs like
/// `/uploads/reports/xyz.jpg` returned by `reports.php`.
const String siteBaseUrl = 'https://andeoske-sapice.app';

String resolveMediaUrl(String relativeUrl) => '$siteBaseUrl$relativeUrl';

/// Wraps a [Dio] client whose session cookie (`andeoske_admin`) is persisted
/// to disk, mirroring how the web admin panel stays logged in via a browser
/// cookie jar. This is required for [features/auth] and [features/admin];
/// anonymous report submission does not need a session at all.
class ApiClient {
  ApiClient(this.dio, this.cookieJar);

  final Dio dio;
  final PersistCookieJar cookieJar;

  Future<void> clearSession() => cookieJar.deleteAll();
}

final apiClientProvider = FutureProvider<ApiClient>((ref) async {
  final supportDir = await getApplicationSupportDirectory();
  final cookieJar = PersistCookieJar(
    storage: FileStorage('${supportDir.path}${Platform.pathSeparator}.cookies'),
  );

  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 30),
      contentType: 'application/json',
      validateStatus: (status) => status != null && status < 500,
    ),
  );
  dio.interceptors.add(CookieManager(cookieJar));

  return ApiClient(dio, cookieJar);
});
