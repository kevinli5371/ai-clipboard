import sys
import json
from ai_process import ClipboardAI

def main():
    clipboard = ClipboardAI()
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            data = json.loads(line)
            command = data.get('type')
            
            if command == 'copy':
                content = data.get('content', '')
                clipboard.add_clipboard_item(content)
                # print(f"Added item: {content}")
                # print(clipboard.get_history())
            
            elif command == 'paste':
                context = data.get('content', '')
                # print(f"Context for suggestion: {context}")
                result = clipboard.suggest_best_item(context)
                print(result)

            sys.stdout.flush()
        
        except Exception as e:
            print(f"Error: {e}")
            break

if __name__ == "__main__":
    main()