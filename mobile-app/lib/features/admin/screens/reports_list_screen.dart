import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../models/admin_report.dart';
import '../providers/reports_admin_provider.dart';

const _urgencyFilterOptions = ['Niska', 'Srednja', 'Visoka'];

final _statusFilterProvider = StateProvider.autoDispose<String?>((ref) => null);
final _urgencyFilterProvider = StateProvider.autoDispose<String?>(
  (ref) => null,
);
final _regionFilterProvider = StateProvider.autoDispose<String?>((ref) => null);

class ReportsListScreen extends ConsumerWidget {
  const ReportsListScreen({super.key});

  Color _urgencyColor(BuildContext context, String urgency) {
    switch (urgency) {
      case 'Visoka':
        return Theme.of(context).colorScheme.error;
      case 'Niska':
        return Theme.of(context).colorScheme.outline;
      default:
        return Theme.of(context).colorScheme.tertiary;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsAdminProvider);
    final authUser = ref.watch(authProvider).value;
    final statusFilter = ref.watch(_statusFilterProvider);
    final urgencyFilter = ref.watch(_urgencyFilterProvider);
    final regionFilter = ref.watch(_regionFilterProvider);
    final hasActiveFilter =
        statusFilter != null || urgencyFilter != null || regionFilter != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prijave'),
        actions: [
          IconButton(
            icon: const Icon(Icons.home_outlined),
            tooltip: 'Naslovnica',
            onPressed: () => context.go('/'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Odjava',
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (authUser != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Prijavljen/a kao ${authUser.username} (${authUser.role})',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),
          Expanded(
            child: reportsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(child: Text('Greška: $error')),
              data: (reports) {
                final regionOptions =
                    reports
                        .map((r) => r.regionName)
                        .whereType<String>()
                        .toSet()
                        .toList()
                      ..sort();

                final filteredReports = reports.where((r) {
                  if (statusFilter != null && r.status != statusFilter) {
                    return false;
                  }
                  if (urgencyFilter != null && r.urgency != urgencyFilter) {
                    return false;
                  }
                  if (regionFilter != null && r.regionName != regionFilter) {
                    return false;
                  }
                  return true;
                }).toList();

                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: _FilterDropdown(
                              label: 'Status',
                              value: statusFilter,
                              options: reportStatusOptions,
                              onChanged: (v) =>
                                  ref
                                          .read(_statusFilterProvider.notifier)
                                          .state =
                                      v,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _FilterDropdown(
                              label: 'Hitnost',
                              value: urgencyFilter,
                              options: _urgencyFilterOptions,
                              onChanged: (v) =>
                                  ref
                                          .read(_urgencyFilterProvider.notifier)
                                          .state =
                                      v,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _FilterDropdown(
                              label: 'Regija',
                              value: regionFilter,
                              options: regionOptions,
                              onChanged: (v) =>
                                  ref
                                          .read(_regionFilterProvider.notifier)
                                          .state =
                                      v,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (hasActiveFilter)
                      Padding(
                        padding: const EdgeInsets.only(
                          left: 12,
                          right: 12,
                          bottom: 4,
                        ),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: () {
                              ref.read(_statusFilterProvider.notifier).state =
                                  null;
                              ref.read(_urgencyFilterProvider.notifier).state =
                                  null;
                              ref.read(_regionFilterProvider.notifier).state =
                                  null;
                            },
                            icon: const Icon(Icons.filter_alt_off, size: 16),
                            label: const Text('Poništi filtere'),
                          ),
                        ),
                      ),
                    const Divider(height: 1),
                    Expanded(
                      child: filteredReports.isEmpty
                          ? Center(
                              child: Text(
                                reports.isEmpty
                                    ? 'Nema prijava.'
                                    : 'Nema prijava koje odgovaraju filteru.',
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () => ref
                                  .read(reportsAdminProvider.notifier)
                                  .refresh(),
                              child: ListView.separated(
                                itemCount: filteredReports.length,
                                separatorBuilder: (_, _) =>
                                    const Divider(height: 1),
                                itemBuilder: (context, index) => _ReportTile(
                                  report: filteredReports[index],
                                  urgencyColor: _urgencyColor(
                                    context,
                                    filteredReports[index].urgency,
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String?>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        isDense: true,
      ),
      items: [
        DropdownMenuItem(
          value: null,
          child: Text('Sve', overflow: TextOverflow.ellipsis),
        ),
        ...options.map(
          (o) => DropdownMenuItem(
            value: o,
            child: Text(o, overflow: TextOverflow.ellipsis),
          ),
        ),
      ],
      onChanged: onChanged,
    );
  }
}

class _ReportTile extends StatelessWidget {
  const _ReportTile({required this.report, required this.urgencyColor});

  final AdminReport report;
  final Color urgencyColor;

  IconData get _urgencyIcon {
    switch (report.urgency) {
      case 'Visoka':
        return Icons.priority_high;
      case 'Niska':
        return Icons.arrow_downward;
      default:
        return Icons.remove;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Tooltip(
        message: 'Hitnost: ${report.urgency}',
        child: CircleAvatar(
          backgroundColor: urgencyColor.withValues(alpha: 0.15),
          foregroundColor: urgencyColor,
          child: Icon(_urgencyIcon),
        ),
      ),
      title: Text(report.category),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(report.place, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(
            'Status: ${report.status} · Hitnost: ${report.urgency}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      isThreeLine: true,
      trailing: Text(report.id, style: Theme.of(context).textTheme.bodySmall),
      onTap: () => context.push('/admin/prijava/${report.id}'),
    );
  }
}
