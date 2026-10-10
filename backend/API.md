# Mark & Define: backend API contract

The extension sends JSON over HTTPS (HTTP is fine for localhost) and expects JSON back.
The base URL and paths are set in `config.js`.

- Method: `POST`
- Request header: `Content-Type: application/json`
- Optional request header: `Authorization: Bearer <AUTH_TOKEN>` (only if set in `config.js`)
- Response header: `Content-Type: application/json`

The extension calls the backend from its service worker, so browser CORS rules do not apply.
No CORS headers are needed.

---

## POST /api/define

Dictionary-style definition of a word or short phrase.

### Request

```json
{
  "text": "ephemeral",
  "context": "Fame in the age of social media can be ephemeral, fading within days.",
  "page": { "url": "https://example.com/article", "title": "Article title" }
}
```

| Field     | Type   | Required | Notes                                                        |
|-----------|--------|----------|--------------------------------------------------------------|
| `text`    | string | yes      | The selected text, whitespace-collapsed, up to 300 chars.    |
| `context` | string | no       | Surrounding paragraph, up to 600 chars. Omitted if disabled. |
| `page`    | object | no       | `url` and `title` of the current page. Omitted if disabled.  |

### Success response (HTTP 200)

```json
{
  "ok": true,
  "term": "ephemeral",
  "phonetic": "/ɪˈfɛm(ə)r(ə)l/",
  "meanings": [
    {
      "partOfSpeech": "adjective",
      "definitions": [
        { "definition": "Lasting for a very short time.", "example": "Ephemeral pleasures." },
        { "definition": "(Of a plant) having a short life cycle." }
      ]
    }
  ],
  "source": "Your service name"
}
```

| Field                                    | Type   | Required | Notes                              |
|------------------------------------------|--------|----------|------------------------------------|
| `ok`                                     | bool   | yes      | `true`                             |
| `meanings`                               | array  | yes      | At least one entry recommended.    |
| `meanings[].definitions`                 | array  | yes      | Each needs a `definition` string.  |
| `meanings[].partOfSpeech`                | string | no       |                                    |
| `meanings[].definitions[].example`       | string | no       |                                    |
| `phonetic`                               | string | no       |                                    |
| `term`                                   | string | no       | Not displayed currently.           |
| `source`                                 | string | no       | Shown in the panel footer.         |

---

## POST /api/explain

A short plain-language explanation of the selected text (a sentence, concept, or phrase).
It can be AI-generated or looked up, as long as it matches this shape.

### Request

Same shape as `/api/define`. `context` and `page` are especially useful here: the same words
can mean different things in different places.

### Success response (HTTP 200)

```json
{
  "ok": true,
  "title": "Photosynthesis",
  "description": "Biological process",
  "explanation": "Plants turn sunlight, water and carbon dioxide into sugar and oxygen.\n\nThis happens mostly in the leaves.",
  "url": "https://example.com/photosynthesis",
  "source": "Your service name"
}
```

| Field         | Type   | Required | Notes                                                       |
|---------------|--------|----------|-------------------------------------------------------------|
| `ok`          | bool   | yes      | `true`                                                      |
| `explanation` | string | yes      | Non-empty. Use `\n\n` to separate paragraphs. Plain text only (no HTML or Markdown). |
| `title`       | string | no       | Shown as a subheading if it differs from the selected text. |
| `description` | string | no       | One-line label shown above the explanation.                 |
| `url`         | string | no       | Adds a "Read more" link in the footer.                      |
| `source`      | string | no       | Shown in the panel footer.                                  |

---

## Errors

| Situation                                     | What to return                                             | What the user sees                               |
|-----------------------------------------------|------------------------------------------------------------|--------------------------------------------------|
| Nothing found for this text                   | HTTP 404, or HTTP 200 `{ "ok": false, "error": "not_found" }` | "No definition/explanation found for ..."        |
| Any other failure (bad input, crash, limits)  | HTTP 4xx/5xx, or HTTP 200 `{ "ok": false, "error": "<code>" }` | "The lookup service returned an error."          |
| No response within `TIMEOUT_MS` (15 s default) | n/a                                                        | "Couldn't reach the lookup service."             |
| Response doesn't match the shapes above       | n/a                                                        | "The lookup service returned an error."          |

Text is always rendered as plain text (never HTML), so responses cannot inject markup into pages.

## Testing without the extension

```bash
curl -X POST http://localhost:3000/api/define \
  -H "Content-Type: application/json" \
  -d '{"text":"ephemeral"}'
```
