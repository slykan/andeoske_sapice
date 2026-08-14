import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart' as latlong;

import '../../../core/api/api_client.dart';
import '../models/admin_report.dart';
import '../providers/reports_admin_provider.dart';
import '../services/admin_directory_service.dart';
import '../services/assignment_service.dart';
import 'photo_viewer_screen.dart';
import 'report_map_screen.dart';

class ReportDetailScreen extends ConsumerWidget {
  const ReportDetailScreen({super.key, required this.publicCode});

  final String publicCode;

  Future<void> _changeStatus(
    BuildContext context,
    WidgetRef ref,
    AdminReport report,
  ) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final status in reportStatusOptions)
              ListTile(
                title: Text(status),
                trailing: status == report.status
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => Navigator.pop(context, status),
              ),
          ],
        ),
      ),
    );

    if (selected == null || selected == report.status || !context.mounted) {
      return;
    }

    try {
      await ref
          .read(reportsAdminProvider.notifier)
          .updateStatus(report.id, selected);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status ažuriran na "$selected".')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsAdminProvider);

    return Scaffold(
      appBar: AppBar(title: Text(publicCode)),
      body: reportsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Greška: $error')),
        data: (reports) {
          final report = reports.where((r) => r.id == publicCode).firstOrNull;
          if (report == null) {
            return const Center(child: Text('Prijava nije pronađena.'));
          }

          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Row(
                  children: [
                    Chip(label: Text(report.status)),
                    const SizedBox(width: 8),
                    Chip(label: Text(report.urgency)),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  report.category,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text('Životinja: ${report.animal}'),
                const SizedBox(height: 16),
                Text(report.description),
                if (report.flags.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    children: report.flags
                        .map((f) => Chip(label: Text(f)))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 16),
                _InfoRow(icon: Icons.place_outlined, label: report.place),
                if (report.latitude != null && report.longitude != null) ...[
                  const SizedBox(height: 8),
                  _LocationPreview(
                    latitude: report.latitude!,
                    longitude: report.longitude!,
                  ),
                ],
                _InfoRow(
                  icon: Icons.email_outlined,
                  label: report.anonymous
                      ? '${report.reporterEmail} (anonimna prijava)'
                      : report.reporterEmail,
                ),
                _InfoRow(
                  icon: Icons.phone_outlined,
                  label: report.reporterPhone,
                ),
                _InfoRow(
                  icon: report.wantsResolutionNotice
                      ? Icons.notifications_active_outlined
                      : Icons.notifications_off_outlined,
                  label:
                      'Želi obavijest o ishodu: ${report.wantsResolutionNotice ? "Da" : "Ne"}',
                ),
                if (report.attachments.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Fotografije',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: report.attachments.where((a) => a.isPhoto).map((
                      a,
                    ) {
                      final url = resolveMediaUrl(a.url);
                      return GestureDetector(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => PhotoViewerScreen(imageUrl: url),
                          ),
                        ),
                        child: Hero(
                          tag: url,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: url,
                              width: 96,
                              height: 96,
                              fit: BoxFit.cover,
                              placeholder: (_, _) => const SizedBox(
                                width: 96,
                                height: 96,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              ),
                              errorWidget: (_, _, _) =>
                                  const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 8),
                Text('Dodjela', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                _AssignmentSection(report: report),
                const SizedBox(height: 24),
                _CommentSection(report: report),
                if (report.notifications.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text('Obavijesti'),
                    children: report.notifications
                        .map((n) => _NotificationTile(notification: n))
                        .toList(),
                  ),
                ],
                if (report.statusHistory.isNotEmpty) ...[
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text('Log'),
                    children: report.statusHistory
                        .map((h) => _HistoryTile(history: h))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => _changeStatus(context, ref, report),
                  icon: const Icon(Icons.sync_alt),
                  label: const Text('Promijeni status'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Region / group (organization) / volunteer assignment. Each dropdown
/// saves immediately on change via `admin.php`'s `assignment` action (which
/// always needs the full current selection + status, not just the changed
/// field), then shows a "notify by mail" button once that target is set —
/// mirroring the web admin panel's region/group/volunteer notify buttons.
class _AssignmentSection extends ConsumerStatefulWidget {
  const _AssignmentSection({required this.report});

  final AdminReport report;

  @override
  ConsumerState<_AssignmentSection> createState() => _AssignmentSectionState();
}

class _AssignmentSectionState extends ConsumerState<_AssignmentSection> {
  bool _savingRegion = false;
  bool _savingOrganization = false;
  bool _savingVolunteer = false;
  bool _sendingRegionMail = false;
  bool _sendingGroupMail = false;
  bool _sendingVolunteerMail = false;

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _saveAssignment({
    String? regionId,
    String? organizationId,
    String? assignedToId,
  }) async {
    final report = widget.report;
    try {
      final service = await ref.read(assignmentServiceProvider.future);
      await service.assign(
        reportId: report.id,
        status: report.status,
        regionId: regionId,
        organizationId: organizationId,
        assignedToId: assignedToId,
        comment: report.comment,
      );
      await ref.read(reportsAdminProvider.notifier).refresh();
      _showMessage('Dodjela je spremljena.');
    } catch (error) {
      _showMessage('$error');
    }
  }

  Future<void> _sendNotify(
    Future<void> Function(AssignmentService service) action,
    void Function(bool) setSending,
  ) async {
    setState(() => setSending(true));
    try {
      final service = await ref.read(assignmentServiceProvider.future);
      await action(service);
      // Refresh so the newly sent email shows up straight away in the
      // "Obavijesti" log below, instead of only after a manual pull-to-refresh.
      await ref.read(reportsAdminProvider.notifier).refresh();
      _showMessage(
        'Obavijest je poslana — vidljivo je u popisu "Obavijesti" ispod.',
      );
    } catch (error) {
      _showMessage('$error');
    } finally {
      if (mounted) setState(() => setSending(false));
    }
  }

  @override
  Widget build(BuildContext context) {
    final directoryAsync = ref.watch(adminDirectoryProvider);
    final report = widget.report;

    return directoryAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: LinearProgressIndicator(),
      ),
      error: (error, _) => Text('Direktorij nije dostupan: $error'),
      data: (directory) {
        final organizations = directory.organizationsForRegion(report.regionId);
        final volunteers = directory.volunteersForRegion(report.regionId);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: report.regionId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Regija',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Nije odabrano'),
                      ),
                      ...directory.regions.map(
                        (r) =>
                            DropdownMenuItem(value: r.id, child: Text(r.name)),
                      ),
                    ],
                    onChanged: _savingRegion
                        ? null
                        : (value) async {
                            setState(() => _savingRegion = true);
                            // Changing region invalidates any group/volunteer
                            // picked under the old region.
                            await _saveAssignment(regionId: value);
                            if (mounted) setState(() => _savingRegion = false);
                          },
                  ),
                ),
                if (report.regionId != null) ...[
                  const SizedBox(width: 8),
                  _MailButton(
                    label: 'Regija mail',
                    sending: _sendingRegionMail,
                    onPressed: () => _sendNotify(
                      (s) => s.notifyRegion(report.id),
                      (v) => _sendingRegionMail = v,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: report.organizationId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Grupa',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      hintText: report.regionId == null
                          ? 'Prvo odaberi regiju'
                          : null,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Nije odabrano'),
                      ),
                      ...organizations.map(
                        (o) =>
                            DropdownMenuItem(value: o.id, child: Text(o.name)),
                      ),
                    ],
                    onChanged: (report.regionId == null || _savingOrganization)
                        ? null
                        : (value) async {
                            setState(() => _savingOrganization = true);
                            await _saveAssignment(
                              regionId: report.regionId,
                              organizationId: value,
                              assignedToId: report.assignedToId,
                            );
                            if (mounted) {
                              setState(() => _savingOrganization = false);
                            }
                          },
                  ),
                ),
                if (report.organizationId != null) ...[
                  const SizedBox(width: 8),
                  _MailButton(
                    label: 'Grupa mail',
                    sending: _sendingGroupMail,
                    onPressed: () => _sendNotify(
                      (s) => s.notifyGroup(report.id),
                      (v) => _sendingGroupMail = v,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: report.assignedToId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Volonter',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      hintText: report.regionId == null
                          ? 'Prvo odaberi regiju'
                          : null,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Nije odabrano'),
                      ),
                      ...volunteers.map(
                        (v) =>
                            DropdownMenuItem(value: v.id, child: Text(v.name)),
                      ),
                    ],
                    onChanged: (report.regionId == null || _savingVolunteer)
                        ? null
                        : (value) async {
                            setState(() => _savingVolunteer = true);
                            await _saveAssignment(
                              regionId: report.regionId,
                              organizationId: report.organizationId,
                              assignedToId: value,
                            );
                            if (mounted) {
                              setState(() => _savingVolunteer = false);
                            }
                          },
                  ),
                ),
                if (report.assignedToId != null) ...[
                  const SizedBox(width: 8),
                  _MailButton(
                    label: 'Volonter mail',
                    sending: _sendingVolunteerMail,
                    onPressed: () => _sendNotify(
                      (s) => s.notifyVolunteer(report.id),
                      (v) => _sendingVolunteerMail = v,
                    ),
                  ),
                ],
              ],
            ),
          ],
        );
      },
    );
  }
}

class _MailButton extends StatelessWidget {
  const _MailButton({
    required this.label,
    required this.sending,
    required this.onPressed,
  });

  final String label;
  final bool sending;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: IconButton.filledTonal(
        onPressed: sending ? null : onPressed,
        icon: sending
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.mail_outline, size: 18),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _CommentSection extends ConsumerStatefulWidget {
  const _CommentSection({required this.report});

  final AdminReport report;

  @override
  ConsumerState<_CommentSection> createState() => _CommentSectionState();
}

class _CommentSectionState extends ConsumerState<_CommentSection> {
  late final _controller = TextEditingController(
    text: widget.report.comment ?? '',
  );
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final report = widget.report;
    try {
      final service = await ref.read(assignmentServiceProvider.future);
      await service.assign(
        reportId: report.id,
        status: report.status,
        regionId: report.regionId,
        organizationId: report.organizationId,
        assignedToId: report.assignedToId,
        comment: _controller.text,
      );
      await ref.read(reportsAdminProvider.notifier).refresh();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Komentar je spremljen.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Komentar', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextField(
          controller: _controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Interna bilješka o slučaju...',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.tonalIcon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined, size: 18),
            label: const Text('Spremi komentar'),
          ),
        ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification});

  final ReportNotificationInfo notification;

  @override
  Widget build(BuildContext context) {
    final sent = notification.status == 'SENT';
    return ListTile(
      dense: true,
      leading: Icon(
        sent ? Icons.mark_email_read_outlined : Icons.error_outline,
        color: sent ? Colors.green : Theme.of(context).colorScheme.error,
      ),
      title: Text(notification.recipientEmail),
      subtitle: Text(
        [
          notification.subject,
          if (notification.responseStatus != null)
            'Odgovor: ${notification.responseStatus}',
          if (notification.createdAt != null) notification.createdAt!,
        ].join(' · '),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.history});

  final ReportStatusHistoryInfo history;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: const Icon(Icons.history, size: 20),
      title: Text(
        history.fromStatus != null
            ? '${history.fromStatus} → ${history.toStatus}'
            : history.toStatus,
      ),
      subtitle: Text(
        [
          if (history.note != null) history.note!,
          if (history.changedByName != null) history.changedByName!,
          if (history.createdAt != null) history.createdAt!,
        ].join(' · '),
      ),
    );
  }
}

class _LocationPreview extends StatelessWidget {
  const _LocationPreview({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  @override
  Widget build(BuildContext context) {
    final point = latlong.LatLng(latitude, longitude);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) =>
              ReportMapScreen(latitude: latitude, longitude: longitude),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          height: 160,
          child: IgnorePointer(
            child: Stack(
              alignment: Alignment.center,
              children: [
                FlutterMap(
                  options: MapOptions(
                    initialCenter: point,
                    initialZoom: 14,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.none,
                    ),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'app.andeoske_sapice.mobile_app',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: point,
                          width: 36,
                          height: 36,
                          child: const Icon(
                            Icons.location_pin,
                            size: 36,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Positioned(
                  bottom: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.fullscreen, size: 14, color: Colors.white),
                        SizedBox(width: 4),
                        Text(
                          'Poveći',
                          style: TextStyle(color: Colors.white, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
