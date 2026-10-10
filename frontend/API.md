# Mark & Define backend API

The extension sends both actions to `POST http://localhost:8000/analyze`.

## Request

```json
{
  "action": "define",
  "text": "ephemeral"
}
```

`action` must be either `define` or `explain`.

## Success response

```json
{
  "success": true,
  "result": "Lasting for a very short time."
}
```

## Error response

```json
{
  "success": false,
  "error": "Error description"
}
```
