import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:gal/gal.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';

void main() => runApp(const ClearCutApp());

class ClearCutApp extends StatelessWidget {
  const ClearCutApp({super.key});

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF10231F);
    const mint = Color(0xFF5EE0B5);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ClearCut',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: mint,
          brightness: Brightness.light,
          primary: ink,
          secondary: mint,
          surface: const Color(0xFFF7FAF8),
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F7F5),
        fontFamily: 'sans-serif',
      ),
      home: const HomeScreen(),
    );
  }
}

enum WorkState { empty, ready, processing, done }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static final Uri _endpoint = Uri.parse(
    'https://tabish1021-clearcut-api.hf.space/api/remove-background',
  );
  static const int _maxBytes = 20 * 1024 * 1024;
  static const _allowedExtensions = {'jpg', 'jpeg', 'png', 'webp'};

  final ImagePicker _picker = ImagePicker();
  XFile? _source;
  Uint8List? _sourceBytes;
  Uint8List? _resultBytes;
  WorkState _state = WorkState.empty;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final image = await _picker.pickImage(source: source, imageQuality: 100);
      if (image == null) return;
      final extension = image.name.split('.').last.toLowerCase();
      final bytes = await image.readAsBytes();
      if (!_allowedExtensions.contains(extension)) {
        _showMessage('Please choose a JPG, JPEG, PNG, or WEBP image.');
        return;
      }
      if (bytes.length > _maxBytes) {
        _showMessage('That image is larger than the 20 MB limit.');
        return;
      }
      setState(() {
        _source = image;
        _sourceBytes = bytes;
        _resultBytes = null;
        _state = WorkState.ready;
      });
    } catch (_) {
      _showMessage('Could not open that image. Please try again.');
    }
  }

  Future<void> _removeBackground() async {
    final source = _source;
    final sourceBytes = _sourceBytes;
    if (source == null || sourceBytes == null) return;
    setState(() => _state = WorkState.processing);

    try {
      final mime = lookupMimeType(source.name) ?? 'image/jpeg';
      final request = http.MultipartRequest('POST', _endpoint)
        ..fields['format'] = 'png'
        ..files.add(
          http.MultipartFile.fromBytes(
            'file',
            sourceBytes,
            filename: source.name,
            contentType: MediaType.parse(mime),
          ),
        );
      final streamed = await request.send().timeout(
        const Duration(seconds: 90),
      );
      final response = await http.Response.fromStream(streamed);
      if (!mounted) return;

      if (response.statusCode == 200) {
        setState(() {
          _resultBytes = response.bodyBytes;
          _state = WorkState.done;
        });
        return;
      }

      setState(() => _state = WorkState.ready);
      _showMessage(_messageForStatus(response.statusCode));
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = WorkState.ready);
      _showMessage(
        'Could not reach ClearCut. Check your internet connection and try again.',
      );
    }
  }

  String _messageForStatus(int status) => switch (status) {
    400 => 'The server could not read this image. Try another file.',
    413 => 'The image is larger than the server\'s 20 MB limit.',
    503 => 'The AI model is waking up. Please wait a moment and retry.',
    _ => 'Background removal failed (error $status). Please try again.',
  };

  Future<void> _saveResult() async {
    final bytes = _resultBytes;
    if (bytes == null) return;
    try {
      final hasAccess = await Gal.hasAccess();
      if (!hasAccess && !await Gal.requestAccess()) {
        _showMessage('Gallery access is needed to save the image.');
        return;
      }
      final name = 'clearcut_${DateTime.now().millisecondsSinceEpoch}.png';
      await Gal.putImageBytes(bytes, name: name);
      _showMessage('Saved to your gallery.', success: true);
    } catch (_) {
      _showMessage(
        'Could not save the image. Please check gallery permission.',
      );
    }
  }

  void _startOver() {
    setState(() {
      _source = null;
      _sourceBytes = null;
      _resultBytes = null;
      _state = WorkState.empty;
    });
  }

  void _showMessage(String message, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: success ? const Color(0xFF176B51) : null,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
              sliver: SliverList.list(
                children: [
                  const _Header(),
                  const SizedBox(height: 30),
                  Text(
                    _state == WorkState.done
                        ? 'Your clean cut\nis ready.'
                        : 'Remove any\nbackground.',
                    style: const TextStyle(
                      fontSize: 40,
                      height: 1.03,
                      letterSpacing: -1.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF10231F),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _state == WorkState.done
                        ? 'Transparent PNG, ready for your next idea.'
                        : 'Pick a photo. ClearCut handles the rest.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.blueGrey.shade600,
                    ),
                  ),
                  const SizedBox(height: 28),
                  _PreviewCard(
                    state: _state,
                    sourceBytes: _sourceBytes,
                    resultBytes: _resultBytes,
                    onGallery: () => _pickImage(ImageSource.gallery),
                    onCamera: () => _pickImage(ImageSource.camera),
                  ),
                  const SizedBox(height: 20),
                  if (_state == WorkState.ready)
                    _PrimaryButton(
                      icon: Icons.auto_awesome_rounded,
                      label: 'Remove background',
                      onPressed: _removeBackground,
                    ),
                  if (_state == WorkState.processing) const _ProcessingButton(),
                  if (_state == WorkState.done) ...[
                    _PrimaryButton(
                      icon: Icons.download_rounded,
                      label: 'Save transparent PNG',
                      onPressed: _saveResult,
                    ),
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: _startOver,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Start with another photo'),
                    ),
                  ],
                  if (_state == WorkState.empty) ...[
                    const SizedBox(height: 18),
                    const _FeatureStrip(),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: const Color(0xFF10231F),
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(
            Icons.content_cut_rounded,
            color: Color(0xFF5EE0B5),
          ),
        ),
        const SizedBox(width: 11),
        const Expanded(
          child: Text(
            'ClearCut',
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(999),
          ),
          child: const Row(
            children: [
              Icon(Icons.key_off_outlined, size: 15),
              SizedBox(width: 5),
              Text('No API key', style: TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({
    required this.state,
    required this.sourceBytes,
    required this.resultBytes,
    required this.onGallery,
    required this.onCamera,
  });

  final WorkState state;
  final Uint8List? sourceBytes;
  final Uint8List? resultBytes;
  final VoidCallback onGallery;
  final VoidCallback onCamera;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 340,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFDDE7E2)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120D2B23),
            blurRadius: 30,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: switch (state) {
        WorkState.empty => _EmptyPicker(
          onGallery: onGallery,
          onCamera: onCamera,
        ),
        WorkState.processing => _ImageStage(
          bytes: sourceBytes!,
          child: const ColoredBox(
            color: Color(0x990B1F1A),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 42,
                    height: 42,
                    child: CircularProgressIndicator(
                      strokeWidth: 4,
                      color: Color(0xFF5EE0B5),
                    ),
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Cutting out the subject…',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        WorkState.done => _Checkerboard(
          child: Image.memory(resultBytes!, fit: BoxFit.contain),
        ),
        WorkState.ready => _ImageStage(
          bytes: sourceBytes!,
          child: Align(
            alignment: Alignment.topRight,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: IconButton.filledTonal(
                onPressed: onGallery,
                tooltip: 'Choose another image',
                icon: const Icon(Icons.swap_horiz_rounded),
              ),
            ),
          ),
        ),
      },
    );
  }
}

class _EmptyPicker extends StatelessWidget {
  const _EmptyPicker({required this.onGallery, required this.onCamera});

  final VoidCallback onGallery;
  final VoidCallback onCamera;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(26),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: const BoxDecoration(
              color: Color(0xFFE2FAF1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.add_photo_alternate_outlined, size: 35),
          ),
          const SizedBox(height: 18),
          const Text(
            'Choose your image',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'JPG, PNG or WEBP · Up to 20 MB',
            style: TextStyle(color: Colors.blueGrey.shade500),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onGallery,
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Gallery'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCamera,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Camera'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ImageStage extends StatelessWidget {
  const _ImageStage({required this.bytes, required this.child});
  final Uint8List bytes;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.memory(bytes, fit: BoxFit.contain),
        child,
      ],
    );
  }
}

class _Checkerboard extends StatelessWidget {
  const _Checkerboard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CheckerPainter(),
      child: Padding(padding: const EdgeInsets.all(10), child: child),
    );
  }
}

class _CheckerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const cell = 18.0;
    final light = Paint()..color = const Color(0xFFF4F6F5);
    final dark = Paint()..color = const Color(0xFFE2E7E5);
    for (double y = 0; y < size.height; y += cell) {
      for (double x = 0; x < size.width; x += cell) {
        final alternate = ((x / cell).floor() + (y / cell).floor()).isOdd;
        canvas.drawRect(
          Rect.fromLTWH(x, y, cell, cell),
          alternate ? dark : light,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(
          label,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _ProcessingButton extends StatelessWidget {
  const _ProcessingButton();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 58,
      child: FilledButton(
        onPressed: null,
        child: Text('Processing your image…'),
      ),
    );
  }
}

class _FeatureStrip extends StatelessWidget {
  const _FeatureStrip();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _TinyFeature(icon: Icons.bolt_rounded, label: 'Fast'),
        _TinyFeature(icon: Icons.hd_outlined, label: 'Full quality'),
        _TinyFeature(icon: Icons.layers_clear_outlined, label: 'Transparent'),
      ],
    );
  }
}

class _TinyFeature extends StatelessWidget {
  const _TinyFeature({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 21, color: const Color(0xFF397363)),
        const SizedBox(height: 5),
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
