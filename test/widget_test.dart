import 'package:background_remover/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the ClearCut image picker', (tester) async {
    await tester.pumpWidget(const ClearCutApp());

    expect(find.text('ClearCut'), findsOneWidget);
    expect(find.text('Remove any\nbackground.'), findsOneWidget);
    expect(find.text('Choose your image'), findsOneWidget);
    expect(find.text('Gallery'), findsOneWidget);
    expect(find.text('Camera'), findsOneWidget);
  });
}
