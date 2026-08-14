import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../models/report_draft_attachment.dart';
import '../providers/categories_provider.dart';
import '../providers/report_form_provider.dart';
import 'location_picker_screen.dart';

const _urgencyOptions = ['Niska', 'Srednja', 'Visoka'];

class NewReportScreen extends ConsumerStatefulWidget {
  const NewReportScreen({super.key, this.recoveredPhoto});

  /// A photo recovered via [ImagePicker.retrieveLostData] after the OS
  /// killed the app process during camera capture (see `HomeScreen`).
  final ReportDraftAttachment? recoveredPhoto;

  @override
  ConsumerState<NewReportScreen> createState() => _NewReportScreenState();
}

class _NewReportScreenState extends ConsumerState<NewReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _placeController = TextEditingController();
  final _animalController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    final recovered = widget.recoveredPhoto;
    if (recovered != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(reportFormProvider.notifier).addAttachment(recovered);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Aplikacija se ponovno pokrenula tijekom fotografiranja, pa je forma '
              'prazna — fotografija je sačuvana, ostala polja molimo ispuni ponovno.',
            ),
            duration: Duration(seconds: 6),
          ),
        );
      });
    }
  }

  @override
  void dispose() {
    _placeController.dispose();
    _animalController.dispose();
    _descriptionController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickLocation() async {
    final form = ref.read(reportFormProvider);
    final result = await Navigator.of(context).push<LocationPickerResult>(
      MaterialPageRoute(
        builder: (_) => LocationPickerScreen(
          initialLatitude: form.latitude,
          initialLongitude: form.longitude,
        ),
      ),
    );
    if (result != null) {
      ref
          .read(reportFormProvider.notifier)
          .setGpsPin(latitude: result.latitude, longitude: result.longitude);
      if (result.address != null && result.address!.trim().isNotEmpty) {
        _placeController.text = result.address!;
      }
    }
  }

  Future<void> _addPhoto(ImageSource source) async {
    final form = ref.read(reportFormProvider);
    if (form.attachments.length >= maxReportAttachments) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Najviše 6 fotografija po prijavi.')),
      );
      return;
    }

    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 80,
      maxWidth: 1920,
    );
    if (picked == null) return;

    final Uint8List bytes = await picked.readAsBytes();
    if (bytes.lengthInBytes > 8 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fotografija je prevelika (max 8 MB).')),
        );
      }
      return;
    }

    final mimeType = picked.mimeType ?? 'image/jpeg';
    ref
        .read(reportFormProvider.notifier)
        .addAttachment(
          ReportDraftAttachment(
            bytes: bytes,
            fileName: picked.name,
            mimeType: mimeType,
          ),
        );
  }

  void _showPhotoSourceSheet() {
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Slikaj'),
              onTap: () {
                Navigator.pop(context);
                _addPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Odaberi iz galerije'),
              onTap: () {
                Navigator.pop(context);
                _addPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final notifier = ref.read(reportFormProvider.notifier);
    notifier.setAnimal(_animalController.text);
    notifier.setDescription(_descriptionController.text);
    notifier.setPlace(_placeController.text);
    notifier.setReporterEmail(_emailController.text);
    notifier.setReporterPhone(_phoneController.text);

    final success = await notifier.submit();
    if (!mounted) return;

    final updated = ref.read(reportFormProvider);
    if (success && updated.publicCode != null) {
      context.push('/prijava-uspjesna', extra: updated.publicCode);
    } else if (updated.errorMessage != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(updated.errorMessage!)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final form = ref.watch(reportFormProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prijavi sumnju'),
        actions: [
          TextButton(
            onPressed: form.isSubmitting ? null : _submit,
            child: form.isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Pošalji'),
          ),
        ],
      ),
      body: categoriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Greška pri učitavanju kategorija: $error')),
        data: (categories) {
          final flags = categories.flagsFor(form.category);

          return SafeArea(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: form.category,
                    decoration: const InputDecoration(
                      labelText: 'Kategorija prijave',
                      border: OutlineInputBorder(),
                    ),
                    items: categories.categories
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (value) {
                      if (value != null) {
                        ref
                            .read(reportFormProvider.notifier)
                            .setCategory(value);
                      }
                    },
                    validator: (value) =>
                        value == null ? 'Odaberi kategoriju' : null,
                  ),
                  if (flags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Dodatni detalji',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Wrap(
                      spacing: 8,
                      children: flags.map((flag) {
                        final selected = form.flags.contains(flag);
                        return FilterChip(
                          label: Text(flag),
                          selected: selected,
                          onSelected: (_) => ref
                              .read(reportFormProvider.notifier)
                              .toggleFlag(flag),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _animalController,
                    decoration: const InputDecoration(
                      labelText: 'Vrsta životinje',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Obavezno polje'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(
                      labelText: 'Opis situacije',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 4,
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Obavezno polje'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Hitnost',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: _urgencyOptions
                        .map((u) => ButtonSegment(value: u, label: Text(u)))
                        .toList(),
                    selected: {form.urgency},
                    onSelectionChanged: (selection) => ref
                        .read(reportFormProvider.notifier)
                        .setUrgency(selection.first),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _placeController,
                    decoration: const InputDecoration(
                      labelText: 'Mjesto / opis lokacije',
                      hintText: 'Npr. ulica, naselje, orijentir',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Obavezno polje'
                        : null,
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _pickLocation,
                    icon: const Icon(Icons.location_on_outlined),
                    label: Text(
                      form.hasLocation
                          ? 'GPS lokacija postavljena (${form.latitude!.toStringAsFixed(5)}, ${form.longitude!.toStringAsFixed(5)})'
                          : 'Postavi GPS lokaciju',
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Fotografije (${form.attachments.length}/$maxReportAttachments)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < form.attachments.length; i++)
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(
                                form.attachments[i].bytes,
                                width: 84,
                                height: 84,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              right: -4,
                              top: -4,
                              child: IconButton(
                                icon: const Icon(
                                  Icons.cancel,
                                  color: Colors.black87,
                                ),
                                onPressed: () => ref
                                    .read(reportFormProvider.notifier)
                                    .removeAttachmentAt(i),
                              ),
                            ),
                          ],
                        ),
                      if (form.attachments.length < maxReportAttachments)
                        InkWell(
                          onTap: _showPhotoSourceSheet,
                          child: Container(
                            width: 84,
                            height: 84,
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: Theme.of(context).colorScheme.outline,
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.add_a_photo_outlined),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Prijavi anonimno'),
                    subtitle: const Text(
                      'Tvoji podaci ostaju vidljivi samo administratorima',
                    ),
                    value: form.anonymous,
                    onChanged: (value) => ref
                        .read(reportFormProvider.notifier)
                        .setAnonymous(value),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Želim obavijest o ishodu prijave'),
                    value: form.wantsResolutionNotice,
                    onChanged: form.anonymous
                        ? null
                        : (value) => ref
                              .read(reportFormProvider.notifier)
                              .setWantsResolutionNotice(value),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: 'Tvoj email',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Obavezno polje';
                      }
                      if (!value.contains('@')) return 'Unesi ispravan email';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _phoneController,
                    decoration: const InputDecoration(
                      labelText: 'Tvoj telefon',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.phone,
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Obavezno polje'
                        : null,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: form.isSubmitting ? null : _submit,
                    child: form.isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Pošalji prijavu'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
