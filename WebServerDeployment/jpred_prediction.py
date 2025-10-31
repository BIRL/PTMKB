from __future__ import annotations

import asyncio
import re
from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

import aiohttp
from bs4 import BeautifulSoup

JPRED_BASE = "http://www.compbio.dundee.ac.uk/jpred4/cgi-bin/rest"
JOB_SUBMIT_URL = f"{JPRED_BASE}/job"
JOB_GET_URL = f"{JPRED_BASE}/job/id/{{jobid}}"

class JPredAioClient:
    def __init__(
        self,
        session: Optional[aiohttp.ClientSession] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_base: float = 0.6,
    ):
        self._external = session is not None
        self._session = session or aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=timeout),
        )
        self._max_retries = max_retries
        self._backoff_base = backoff_base

    async def __aenter__(self) -> "JPredAioClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if not self._external:
            await self._session.close()

    async def _retry(self, fn, *args, **kwargs):
        for attempt in range(self._max_retries + 1):
            try:
                return await fn(*args, **kwargs)
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt < self._max_retries:
                    await asyncio.sleep(self._backoff_base * (2 ** attempt))
                    continue
                raise

    async def post_text(self, url: str, data: bytes, headers: Dict[str, str]) -> aiohttp.ClientResponse:
        async def _do():
            return await self._session.post(url, data=data, headers=headers)
        return await self._retry(_do)

    async def get_text(self, url: str) -> Tuple[int, str, aiohttp.CIMultiDictProxy[str]]:
        async def _do():
            async with self._session.get(url) as resp:
                text = await resp.text()
                return resp.status, text, resp.headers
        return await self._retry(_do)

async def submit_job(seq: str, session: Optional[aiohttp.ClientSession] = None) -> Dict[str, str]:
    """
    Submit a JPred job. Returns:
      - {'message': 'Job submitted!', 'jobid': 'jp_xxxxx'} on success (202)
      - {'message': 'Could not submit job! Sequence is too long.'} when Location/jobid missing
      - {'message': 'Could not submit job! URL error.'} on non-202
      - {'message': 'Response error from the server!'} on network errors
    """
    # Build body exactly like your original function
    sequence_query = f">query\n{seq}"
    parameters_dict = OrderedDict([("skipPDB", True), ("format", "seq")])
    parameters_list = [f"{k}={v}" for k, v in parameters_dict.items() if v]
    parameters_list.append(sequence_query)
    body = u"£€£€".join(parameters_list)

    async with JPredAioClient(session=session) as jp:
        try:
            resp = await jp.post_text(
                JOB_SUBMIT_URL,
                data=body,
                headers={"Content-type": "text/txt"},
            )
        except Exception:
            return {"message": "Response error from the server!"}

        # JPred signals accepted job with 202 + Location header
        if resp.status == 202:
            location = resp.headers.get("Location", "")
            m = re.search(r"(jp_.*)$", location)
            if m:
                return {"message": "Job submitted!", "jobid": m.group(1)}
            return {"message": "Could not submit job! Sequence is too long."}
        else:
            return {"message": "Could not submit job! URL error."}


async def get_job(jobid: str, session: Optional[aiohttp.ClientSession] = None) -> Dict[str, Any]:
    """
    Query job status and fetch results page when ready.
    Returns:
      - {'response': True, 'content': '<html ...>'} when finished
      - {'response': False} otherwise (including network errors)
    Note: keeps your original readiness logic.
    """
    async with JPredAioClient(session=session) as jp:
        try:
            status_code, text, _ = await jp.get_text(JOB_GET_URL.format(jobid=jobid))
        except Exception:
            return {"response": False}

        if 200 <= status_code < 300:
            lower = text.lower()
            if ("finished" not in lower) or ("100%" in lower):
                return {"response": False}

            try:
                base = text.split("Results available at the following URL:")[-1].strip().split(".results")[0]
                results_url = base + ".html"
            except Exception:
                return {"response": False}

            # Fetch the HTML result
            try:
                _, html, _ = await jp.get_text(results_url)
                return {"response": True, "content": html}
            except Exception:
                return {"response": False}

        return {"response": False}


def format_jpred_response(response_html: str) -> Dict[str, Dict[str, str]]:
    """
    Parse the JPred results HTML into:
      {
        'alignment': { line_key: line_value, ... },
        'prediction': { line_key: line_value, ... }
      }
    """
    parsed_html = BeautifulSoup(response_html, "html.parser")
    code_tag = parsed_html.find("code")
    if not code_tag or not code_tag.text:
        return {"alignment": {}, "prediction": {}}

    code_chunk: str = code_tag.text
    formatted_response: Dict[str, Dict[str, str]] = {"alignment": {}, "prediction": {}}

    for raw in code_chunk.splitlines():
        if not raw:
            continue
        parts = raw.split(":", 1)
        key = parts[0].strip()
        value = parts[1].strip() if len(parts) > 1 else ""

        if ("UniRef" in key) or ("QUERY" in key):
            formatted_response["alignment"][key] = value
        else:
            if key == "":
                key = "Pos"
            formatted_response["prediction"][key] = value

    return formatted_response

async def wait_for_job(
    jobid: str,
    session: Optional[aiohttp.ClientSession] = None,
    interval_seconds: float = 3.0,
    max_wait_seconds: float = 300.0,
) -> Dict[str, Any]:
    """
    Polls get_job() until finished or timeout. Returns the same dict as get_job().
    """
    deadline = asyncio.get_event_loop().time() + max_wait_seconds
    while True:
        res = await get_job(jobid, session=session)
        if res.get("response"):
            return res
        if asyncio.get_event_loop().time() >= deadline:
            return {"response": False}
        await asyncio.sleep(interval_seconds)