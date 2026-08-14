import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart' as latlong;

import '../services/geocoding_service.dart';

class LocationPickerResult {
  const LocationPickerResult(this.latitude, this.longitude, {this.address});
  final double latitude;
  final double longitude;
  final String? address;
}

/// Lets the reporter confirm the incident location: tries to auto-locate via
/// GPS on open, then allows dragging the map to fine-tune the pin (e.g. when
/// reporting on behalf of someone else, or GPS accuracy is poor). Uses
/// OpenStreetMap tiles per the project plan (not Google Maps).
class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
  });

  final double? initialLatitude;
  final double? initialLongitude;

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  static const _fallbackCenter = latlong.LatLng(
    45.1,
    15.2,
  ); // Croatia, rough center
  final _mapController = MapController();
  latlong.LatLng _center = _fallbackCenter;
  bool _locating = false;
  bool _confirming = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialLatitude != null && widget.initialLongitude != null) {
      _center = latlong.LatLng(
        widget.initialLatitude!,
        widget.initialLongitude!,
      );
    } else {
      _locateMe();
    }
  }

  Future<void> _locateMe() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Lokacijske usluge su isključene.');
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Dozvola za lokaciju nije odobrena.');
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      final target = latlong.LatLng(position.latitude, position.longitude);
      setState(() => _center = target);
      _mapController.move(target, 16);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _confirm() async {
    setState(() => _confirming = true);
    final address = await reverseGeocode(_center.latitude, _center.longitude);
    if (!mounted) return;
    Navigator.of(context).pop(
      LocationPickerResult(
        _center.latitude,
        _center.longitude,
        address: address,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Potvrdi lokaciju'),
        actions: [
          IconButton(
            tooltip: 'Moja lokacija',
            icon: _locating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location),
            onPressed: _locating ? null : _locateMe,
          ),
        ],
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 15,
              onPositionChanged: (camera, hasGesture) {
                if (hasGesture) {
                  _center = camera.center;
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'app.andeoske_sapice.mobile_app',
              ),
            ],
          ),
          const IgnorePointer(
            child: Padding(
              padding: EdgeInsets.only(bottom: 40),
              child: Icon(Icons.location_pin, size: 44, color: Colors.red),
            ),
          ),
          if (_error != null)
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Material(
                color: Theme.of(context).colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_error!),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _confirming ? null : _confirm,
            child: _confirming
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Potvrdi ovu lokaciju'),
          ),
        ),
      ),
    );
  }
}
