import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _submitting = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    await ref
        .read(authProvider.notifier)
        .login(
          _usernameController.text.trim(),
          _passwordController.text,
          rememberMe: _rememberMe,
        );
    if (mounted) setState(() => _submitting = false);
    // Navigation on success happens via the ref.listen below, which also
    // covers the case where a persisted session is restored before the
    // user even finishes typing.
  }

  @override
  Widget build(BuildContext context) {
    // Covers both "session already restored from a persisted cookie" (so
    // this screen shouldn't even have been shown) and "login just
    // succeeded" — either way, move on to the admin area.
    ref.listen(authProvider, (previous, next) {
      if (next.hasError) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(next.error.toString())));
        return;
      }
      if (next.hasValue && next.value != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.go('/admin');
        });
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prijava za volontere i administratore'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Prijavi se',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Email ili korisničko ime',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Obavezno polje'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    decoration: InputDecoration(
                      labelText: 'Lozinka',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility
                              : Icons.visibility_off,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                    obscureText: _obscurePassword,
                    validator: (value) => (value == null || value.isEmpty)
                        ? 'Obavezno polje'
                        : null,
                    onFieldSubmitted: (_) => _submit(),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('Zapamti me'),
                    subtitle: const Text('Ostani prijavljen/a na ovom uređaju'),
                    value: _rememberMe,
                    onChanged: (value) =>
                        setState(() => _rememberMe = value ?? true),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Prijavi se'),
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
