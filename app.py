import os
import tempfile
import uuid
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from converter_backend import DocumentConverter

app = Flask(__name__)
# Permitir peticiones desde cualquier origen (CORS) para el frontend
CORS(app)

TEMP_DIR = tempfile.gettempdir()

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

        # Crear un ID único para el archivo
        file_id = str(uuid.uuid4())
        filename = f"Documento_{ai_source.replace(' ', '_')}.docx"
        output_path = os.path.join(TEMP_DIR, f"{file_id}.docx")

        converter = DocumentConverter()
        converter.convert_markdown_to_docx(
            md_text=text,
            output_path=output_path,
            font_name=font_name,
            font_size=font_size,
            ai_source=ai_source
        )

        # Devolver la URL de descarga
        return jsonify({
            'success': True, 
            'download_url': f"/api/download/{file_id}",
            'filename': filename
        })

    except Exception as e:
        print(f"Server error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<file_id>', methods=['GET'])
def download_word(file_id):
    try:
        filename = request.args.get('filename', 'Documento.docx')
        filepath = os.path.join(TEMP_DIR, f"{file_id}.docx")
        
        if os.path.exists(filepath):
            # Enviar el archivo
            return send_file(filepath, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'Archivo expirado o no encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/visits', methods=['GET'])
def proxy_visits():
    import urllib.request
    import json
    try:
        # Actuamos como puente para evadir los bloqueadores de rastreadores de Edge
        url = 'https://api.counterapi.dev/v1/wordweaver_emil_paz/visits/up'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return jsonify(data)
    except Exception as e:
        print(f"Error fetching visits: {e}")
        return jsonify({'count': '-'}), 500

if __name__ == '__main__':
    # Para desarrollo local
    app.run(debug=True, port=5000)
