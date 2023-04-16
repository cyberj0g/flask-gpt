import os
from flask import Flask, request, jsonify, send_from_directory
import openai

import config
import logging

logging.basicConfig(level=logging.DEBUG,
                    format='[%(asctime)s.%(msecs)03d]: %(process)d %(levelname)s %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S',
                    handlers=[logging.StreamHandler()])

app = Flask(__name__)
openai.api_key = os.environ.get('API_KEY')

conversations = {}

def postprocess_ai_response(response):
    return response['choices'][0]['message']['content']

def preprocess_user_input(data):
    return data

@app.route('/api/process-text', methods=['POST'])
def process_text():
    data = request.get_json()
    if 'text' not in data:
        return jsonify({'error': 'No text in request'}), 400
    text = data['text'].strip()
    model_input = preprocess_user_input(text)
    id = data['id']
    mode = data['mode']
    if id not in conversations:
        conversations[id] = config.gpt_contexts[mode].copy()
        logging.debug(f'New conversation id {id}')
    if text != '':
        conversations[id].append({'role': 'user', 'content': model_input})
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=conversations[id]
    )
    response_text = postprocess_ai_response(response)
    conversations[id].append({'role': 'assistant', 'content': response_text})
    logging.debug(response_text)
    return jsonify({'message': response_text})


@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


@app.route('/api/modes')
def get_modes():
    languages = [{'name': key, 'value': key} for key in config.gpt_contexts.keys()]
    return jsonify(languages)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, ssl_context='adhoc')
