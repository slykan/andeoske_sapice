import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as latlong;

/// Fullscreen, zoomable read-only map centered on a report's location.
class ReportMapScreen extends StatelessWidget {
  const ReportMapScreen({
    super.key,
    required this.latitude,
    required this.longitude,
    this.title,
  });

  final double latitude;
  final double longitude;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final point = latlong.LatLng(latitude, longitude);

    return Scaffold(
      appBar: AppBar(title: Text(title ?? 'Lokacija prijave')),
      body: FlutterMap(
        options: MapOptions(initialCenter: point, initialZoom: 16),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'app.andeoske_sapice.mobile_app',
          ),
          MarkerLayer(
            markers: [
              Marker(
                point: point,
                width: 44,
                height: 44,
                child: const Icon(
                  Icons.location_pin,
                  size: 44,
                  color: Colors.red,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
