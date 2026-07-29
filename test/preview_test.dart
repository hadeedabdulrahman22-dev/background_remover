import 'dart:io';
import 'dart:typed_data';

import 'package:background_remover/main.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders phone preview', (tester) async {
    final fontBytes = await File(
      r'C:\Users\Abdullah\Downloads\flutter\bin\cache\artifacts\material_fonts\roboto-regular.ttf',
    ).readAsBytes();
    await (FontLoader('sans-serif')
          ..addFont(Future.value(ByteData.sublistView(fontBytes))))
        .load();
    await tester.binding.setSurfaceSize(const Size(412, 915));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const ClearCutApp());
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(ClearCutApp),
      matchesGoldenFile('goldens/clearcut_home.png'),
    );
  });
}
