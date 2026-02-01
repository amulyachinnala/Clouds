import json
import os

import httpx


GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-pro:generateContent"
)

FALLBACK_RESPONSE = (
    "I can give guidance, but I can't finalize spending decisions. "
    "Check your available cash and EXP, prioritize essentials, and consider waiting if this purchase "
    "reduces your buffer."
)


def _extract_context_numbers(prompt: str) -> tuple[str | None, str | None, str | None]:
    marker = "APP_CONTEXT:"
    if marker not in prompt:
        return None, None, None
    try:
        context_block = prompt.split(marker, 1)[1].strip()
        json_text = context_block.split("USER_MESSAGE:", 1)[0].strip()
        ctx = json.loads(json_text)
        month_state = ctx.get("month_state", {})
        cash = month_state.get("cash_available")
        exp = month_state.get("exp_available")
        pending = ctx.get("task_summary", {}).get("pending_today")
        return (
            f"{cash:.2f}" if isinstance(cash, (int, float)) else None,
            f"{exp:.0f}" if isinstance(exp, (int, float)) else None,
            f"{pending}" if isinstance(pending, (int, float)) else None,
        )
    except Exception:
        return None, None, None


async def gemini_chat(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        cash, exp, pending = _extract_context_numbers(prompt)
        if cash and exp and pending:
            return (
                "I can’t access the AI coach right now, but you have "
                f"${cash} cash available and {exp} EXP available. "
                f"Consider completing {pending} task(s) to unlock more."
            )
        return FALLBACK_RESPONSE
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{GEMINI_URL}?key={api_key}", json=payload)
        if resp.status_code >= 400:
            return FALLBACK_RESPONSE
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return FALLBACK_RESPONSE
