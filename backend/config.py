import os

SOCKET_PORT = 8080
HISTORY_LIMIT = 10
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')