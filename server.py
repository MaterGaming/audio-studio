# simple_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir('mini_app')
server = HTTPServer(('localhost', 8000), SimpleHTTPRequestHandler)
print('Сервер запущен на http://localhost:8000')
server.serve_forever()