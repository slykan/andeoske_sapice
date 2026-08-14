class RegionOption {
  const RegionOption({required this.id, required this.name});

  factory RegionOption.fromJson(Map<String, dynamic> json) {
    return RegionOption(id: json['id'] as String, name: json['name'] as String);
  }

  final String id;
  final String name;
}

class OrganizationOption {
  const OrganizationOption({
    required this.id,
    required this.name,
    this.regionId,
  });

  factory OrganizationOption.fromJson(Map<String, dynamic> json) {
    return OrganizationOption(
      id: json['id'] as String,
      name: json['name'] as String,
      regionId: json['regionId'] as String?,
    );
  }

  final String id;
  final String name;
  final String? regionId;
}

class VolunteerOption {
  const VolunteerOption({
    required this.id,
    required this.name,
    required this.role,
    this.regionId,
  });

  factory VolunteerOption.fromJson(Map<String, dynamic> json) {
    final name = (json['name'] as String?)?.trim();
    return VolunteerOption(
      id: json['id'] as String,
      name: (name == null || name.isEmpty)
          ? (json['email'] as String? ?? '')
          : name,
      role: json['role'] as String? ?? 'VOLUNTEER',
      regionId: json['regionId'] as String?,
    );
  }

  final String id;
  final String name;
  final String role;
  final String? regionId;
}

/// Mirrors `listAdminData()` in `public/api/admin.php` (GET) — already
/// scoped server-side by role (ADMIN sees everything, VOLUNTEER/ORGANIZATION
/// see only their own region).
class AdminDirectory {
  const AdminDirectory({
    required this.regions,
    required this.organizations,
    required this.volunteers,
  });

  factory AdminDirectory.fromJson(Map<String, dynamic> json) {
    return AdminDirectory(
      regions: (json['regions'] as List? ?? const [])
          .map((r) => RegionOption.fromJson(r as Map<String, dynamic>))
          .toList(),
      organizations: (json['organizations'] as List? ?? const [])
          .map((o) => OrganizationOption.fromJson(o as Map<String, dynamic>))
          .toList(),
      volunteers: (json['users'] as List? ?? const [])
          .map((u) => VolunteerOption.fromJson(u as Map<String, dynamic>))
          .where((u) => u.role == 'VOLUNTEER' || u.role == 'ADMIN')
          .toList(),
    );
  }

  final List<RegionOption> regions;
  final List<OrganizationOption> organizations;
  final List<VolunteerOption> volunteers;

  List<OrganizationOption> organizationsForRegion(String? regionId) {
    if (regionId == null) return const [];
    return organizations.where((o) => o.regionId == regionId).toList();
  }

  List<VolunteerOption> volunteersForRegion(String? regionId) {
    if (regionId == null) return const [];
    return volunteers.where((u) => u.regionId == regionId).toList();
  }
}
