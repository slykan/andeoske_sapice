import 'package:dio/dio.dart';

/// Reverse-geocodes a GPS point into a human-readable address via
/// OpenStreetMap's Nominatim (consistent with the OSM tiles already used
/// for the map, per the project plan — no Google API key involved).
/// Returns null on any failure so the caller can fall back to manual entry.
Future<String?> reverseGeocode(double latitude, double longitude) async {
  try {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        headers: {
          // Required by Nominatim's usage policy: identify the app.
          'User-Agent': 'AndeoskeSapiceMobileApp/1.0',
        },
      ),
    );

    final response = await dio.get<Map<String, dynamic>>(
      'https://nominatim.openstreetmap.org/reverse',
      queryParameters: {
        'format': 'jsonv2',
        'lat': latitude,
        'lon': longitude,
        'accept-language': 'hr',
      },
    );

    final data = response.data;
    if (data == null) return null;

    final address = data['address'] as Map<String, dynamic>?;
    if (address != null) {
      final street = address['road'] as String?;
      final houseNumber = address['house_number'] as String?;
      final place =
          (address['city'] ??
                  address['town'] ??
                  address['village'] ??
                  address['municipality'])
              as String?;

      final parts = <String>[
        ?street != null
            ? [street, houseNumber].where((p) => p != null).join(' ')
            : null,
        ?place,
      ];
      if (parts.isNotEmpty) return parts.join(', ');
    }

    return data['display_name'] as String?;
  } catch (_) {
    return null;
  }
}
