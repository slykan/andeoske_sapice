import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

class ReportCategories {
  const ReportCategories({
    required this.categories,
    required this.subcategories,
  });

  final List<String> categories;
  final Map<String, List<String>> subcategories;

  List<String> flagsFor(String? category) =>
      subcategories[category] ?? const [];
}

final categoriesProvider = FutureProvider<ReportCategories>((ref) async {
  final client = await ref.watch(apiClientProvider.future);
  final response = await client.dio.get<Map<String, dynamic>>(
    '/categories.php',
  );
  final data = response.data ?? const {};

  final categories = (data['categories'] as List? ?? const []).cast<String>();
  final rawSubcategories = (data['subcategories'] as Map? ?? const {});
  final subcategories = rawSubcategories.map(
    (key, value) =>
        MapEntry(key as String, (value as List? ?? const []).cast<String>()),
  );

  return ReportCategories(categories: categories, subcategories: subcategories);
});
