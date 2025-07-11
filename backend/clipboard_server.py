import socket
import json
from ai_process import ClipboardAI
from config import SOCKET_PORT

def start_server():
    ai_engine = ClipboardAI()

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as socket_server:
        socket_server.bind(('localhost', SOCKET_PORT))
        socket_server.listen()

        print(f'Server listening on port {SOCKET_PORT}')

        while True:
            conn, addr = socket_server.accept()
            with conn:
                print(f'Connected by {addr}')
                data = conn.recv(4096)
                if not data:
                    continue

                try:
                    request = json.loads(data.decode())

                    if request['type'] == 'paste':
                        context = request['content']
                        print(f'Received paste request: {context}')
                        if len(ai_engine.history) == 0:
                            print("No items in clipboard")
                            continue
                        suggestion, score = ai_engine.suggest_best_item(context)
                        conn.sendall(suggestion.encode())
                        print(f'Response: {suggestion} sent with score {score}')
                    
                    if request['type'] == 'copy':
                        content = request['content']
                        print(f'Received copy request: {content}')
                        ai_engine.add_clipboard_item(content)
                        print(f'Content added to clipboard: {content}')

                except Exception as e:
                    print(f'Error processing request: {e}')

if __name__ == '__main__':
    start_server()