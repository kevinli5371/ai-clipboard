from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from config import MODEL_NAME, HISTORY_LIMIT, MODEL_PATH

class ClipboardAI:
    def __init__(self):
        self.model = SentenceTransformer(MODEL_PATH)
        self.max_history = HISTORY_LIMIT
        self.history = []

    def add_clipboard_item(self, item):
        # transforms/encodes the item into a vector used for semantic search
        embedding = self.model.encode([item])[0]
        self.history.append((item, embedding))
        if len(self.history) > self.max_history:
            self.history.pop(0)
    
    def suggest_best_item(self, context_text):
        if not self.history:
            return None

        context_emb = self.model.encode([context_text])[0]
        texts, embeddings = zip(*self.history)
        similarities = cosine_similarity([context_emb], embeddings)[0]
        best_index = similarities.argmax()
        return texts[best_index], similarities[best_index]

    def get_history(self):
        return [item for item, _ in self.history]

clipboard = ClipboardAI()

test_items = [
    "123 Queen Street, Toronto",
    "def hello(): print('Hello World')",
    "Hey, can you send me the meeting link?",
    "https://openai.com/research/gpt-4",
    "Invoice #42839 — Total Due: $1,250",
    "The capital of France is Paris.",
    "My email is kevin@example.com",
    "Remember to buy eggs, milk, and spinach.",
    "To reset your password, click the link below.",
    "2025-07-15 at 3:00 PM"
]

for item in test_items:
    clipboard.add_clipboard_item(item)

print(clipboard.suggest_best_item("google.com search bar"))