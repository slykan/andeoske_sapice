import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/notification_prefs_service.dart';

final _notificationPrefsProvider = FutureProvider.autoDispose((ref) async {
  final service = await ref.watch(notificationPrefsServiceProvider.future);
  return service.fetch();
});

class NotificationPrefsScreen extends ConsumerWidget {
  const NotificationPrefsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefsAsync = ref.watch(_notificationPrefsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Postavke obavijesti')),
      body: prefsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Greška: $error')),
        data: (prefs) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Kako želiš primati obavijesti o novim i dodijeljenim prijavama?',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 16),
            RadioGroup<String>(
              groupValue: prefs.channel,
              onChanged: (value) async {
                if (value == null || !prefs.editable) return;
                final service = await ref.read(
                  notificationPrefsServiceProvider.future,
                );
                await service.update(value);
                ref.invalidate(_notificationPrefsProvider);
              },
              child: Column(
                children: [
                  RadioListTile<String>(
                    title: const Text('Email'),
                    value: 'EMAIL',
                    enabled: prefs.editable,
                  ),
                  const RadioListTile<String>(
                    title: Text('Push obavijesti'),
                    subtitle: Text('Uskoro dostupno'),
                    value: 'PUSH',
                    enabled: false,
                  ),
                ],
              ),
            ),
            if (!prefs.editable) ...[
              const SizedBox(height: 16),
              const Text(
                'Ovaj admin račun nema korisnički zapis pa se postavka ne može spremiti '
                '(koristi se ugrađeni administratorski login).',
                style: TextStyle(fontStyle: FontStyle.italic),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
