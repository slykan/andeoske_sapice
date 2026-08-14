/// Mirrors the shape returned by `session.php` (GET/POST): it only ever
/// exposes `username` and `role`, since the PHP session itself is what
/// carries the real identity.
class AuthUser {
  const AuthUser({required this.username, required this.role});

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      username: (json['username'] as String?) ?? '',
      role: (json['role'] as String?) ?? 'ADMIN',
    );
  }

  final String username;
  final String role;

  bool get isVolunteer => role == 'VOLUNTEER';
  bool get isAdmin => role == 'ADMIN';
  bool get isOrganization => role == 'ORGANIZATION';
}
