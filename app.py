import os
import tempfile
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from converter_backend import DocumentConverter

app = Flask(__name__)
# Permitir peticiones desde cualquier origen (CORS) para el frontend
CORS(app)

@app.route('/api/export_word', methods=['POST'])
def export_word():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400

        text = data.get('text', '')
        ai_source = data.get('aiSource', 'Gemini AI')
        font_name = data.get('fontName', 'Arial')
        font_size = int(data.get('fontSize', 11))

        # Crear archivo temporal para el docx
        fd, temp_path = tempfile.mkstemp(suffix='.docx')
        os.close(fd)

        converter = DocumentConverter()
        output_path = converter.convert_markdown_to_docx(
            md_text=text,
            output_path=temp_path,
            font_name=font_name,
            font_size=font_size,
            ai_source=ai_source
        )

        filename = f"Documento_{ai_source.replace(' ', '_')}.docx"

        # Enviar el archivo y luego eliminarlo (usando un generador para cleanup)
        def generate():
            with open(output_path, "rb") as f:
                yield from f
            os.remove(output_path)

        from flask import Response
        return Response(generate(), mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        headers={'Content-Disposition': f'attachment; filename={filename}'})

    except Exception as e:
        print(f"Server error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Para desarrollo local
    app.run(debug=True, port=5000)
