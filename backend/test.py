import socket, json

data = [
    # {
    #     "type": "copy",
    #     "content": "123 Queen Street, Toronto",
    #     "source": "macOS"
    # },
    # {
    #     "type": "copy",
    #     "content": "kevinli@gmail.com",
    #     "source": "macOS"
    # }
    # {
    #     "type": "copy",
    #     "content": "https://www.youtube.com/watch?v=4jTcnDH7jgw",
    #     "source": "macOS"
    # }
    {
        "type": "paste",
        "content": "Whats the address?",
        "source": "macOS"
    }
]

with socket.socket() as s:
    s.connect(('localhost', 8080))
    for item in data:
        s.sendall(json.dumps(item).encode())
        response = s.recv(4096)
        print("Response:", response.decode())