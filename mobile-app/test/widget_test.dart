import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_app/app.dart';

void main() {
  testWidgets('Home screen shows the report CTA', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AndeoskeSapiceApp()));
    await tester.pumpAndSettle();

    expect(find.text('Prijavi sumnju'), findsWidgets);
  });
}
