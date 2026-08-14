import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../report/models/report_draft_attachment.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // On some Android devices, launching the camera can make the OS kill the
    // app process to free memory; Flutter then cold-restarts here at '/'.
    // image_picker keeps the captured file on disk regardless, so recover it
    // and hand it straight to a fresh report form instead of losing it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _recoverLostPhoto());
  }

  Future<void> _recoverLostPhoto() async {
    final response = await ImagePicker().retrieveLostData();
    if (response.isEmpty || response.file == null) return;

    final bytes = await response.file!.readAsBytes();
    if (!mounted) return;

    final attachment = ReportDraftAttachment(
      bytes: bytes,
      fileName: response.file!.name,
      mimeType: response.file!.mimeType ?? 'image/jpeg',
    );
    context.push('/prijava', extra: attachment);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/images/app_icon.png',
                    width: 140,
                    height: 140,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Prijavi sumnju na zanemarivanje ili zlostavljanje životinje',
                    style: Theme.of(context).textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: () => context.push('/prijava'),
                    icon: const Icon(Icons.report_outlined),
                    label: const Text('Prijavi sumnju'),
                  ),
                  const SizedBox(height: 16),
                  TextButton.icon(
                    onPressed: () => context.push('/login'),
                    icon: const Icon(Icons.shield_outlined),
                    label: const Text('Prijava za volontere i administratore'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
