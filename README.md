# TEKA - Explain and Define Chrome Extension

A small Chrome extension prototype we made for a hackathon. Select some text on a webpage and choose Define or Explain, the extension sends it to a local AI model and shows the answer next to the selection.

Everything runs locally using Flask, Ollama and Gemma 3 4B.

## Running it

Start Ollama on port 8001.

```bash
ollama pull gemma3:4b
OLLAMA_HOST=127.0.0.1:8001 ollama serve
```

Then start the backend.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install flask
python app.py
```

To install the extension open `chrome://extensions`, turn on Developer mode and press **Load unpacked**. Choose the `frontend` folder, refresh your webpage and select some text.

The Flask API runs on port 8000 and Ollama runs on port 8001.
