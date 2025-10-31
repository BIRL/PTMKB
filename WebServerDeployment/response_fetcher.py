from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Tuple, Optional
import contextlib
import aiohttp

UNIPROTKB_BASE = "https://rest.uniprot.org/uniprotkb"
UNIPARC_BASE = "https://rest.uniprot.org/uniparc"

def get_ptms(response: Dict[str, Any]) -> Dict[str, List[Tuple[str, List[str]]]]:
    out: Dict[str, List[Tuple[str, List[str]]]] = {}
    for feat in response.get("features", []):
        if "modified residue" in str(feat.get("type", "")).lower():
            position = (
                feat.get("location", {})
                .get("start", {})
                .get("value")
            )
            if not position:
                continue

            desc = (feat.get("description") or "").split(";")
            if len(desc) > 1:
                ptm = desc[0].strip()
                enzymes = (
                    desc[1]
                    .replace("by", "")
                    .replace("and", ",")
                    .replace("/", ",")
                )
                enzymes = [e.strip() for e in enzymes.split(",") if e.strip()]
            else:
                ptm = (desc[0] or "").strip()
                enzymes = []

            out.setdefault(str(position), []).append((ptm, enzymes))
    return out


def parse_subcellular_localizations(entry: Dict[str, Any]) -> str:
    comments = entry.get("comments", [])
    lines: List[str] = []
    for c in comments:
        if c.get("commentType") != "SUBCELLULAR LOCATION":
            continue
        parts: List[str] = []
        molecule = c.get("molecule")
        if molecule:
            parts.append(f"{molecule}:")
        for loc in c.get("subcellularLocations", []):
            val = loc.get("location", {}).get("value")
            if val:
                parts.append(val)
        notes = c.get("note", {}).get("texts", [])
        if notes:
            parts.append("-")
            for n in notes:
                v = n.get("value")
                if v:
                    parts.append(v)
        lines.append(" ".join(parts).strip())
    return ("\n".join(lines)).strip()


def first_text(entry: Dict[str, Any], comment_type: str) -> str:
    out: List[str] = []
    for c in entry.get("comments", []):
        if c.get("commentType") == comment_type:
            texts = c.get("texts") or []
            if texts and "value" in texts[0]:
                out.append(texts[0]["value"])
    return ("\n".join(out)).strip()


def get_protein_name(entry: Dict[str, Any]) -> str:
    pd = entry.get("proteinDescription", {}) or {}
    name = (
        pd.get("recommendedName", {})
        .get("fullName", {})
        .get("value")
    )
    if name:
        return name
    with contextlib.suppress(Exception):
        return pd["submissionNames"][0]["fullName"]["value"]
    return ""


def get_gene_name(entry: Dict[str, Any]) -> str:
    genes = entry.get("genes") or []
    if not genes:
        return ""
    g0 = genes[0]
    val = (g0.get("geneName") or {}).get("value")
    if val:
        return val
    orfs = g0.get("orfNames") or []
    if orfs:
        return ", ".join([o.get("value", "") for o in orfs if o.get("value")])
    return ""


def get_organism(entry: Dict[str, Any]) -> str:
    org = entry.get("organism") or {}
    sci = org.get("scientificName") or ""
    common = org.get("commonName")
    if common:
        return f"{sci} ({common})"
    return sci


def init_return_dict() -> Dict[str, Any]:
    return dict.fromkeys(
        [
            "uniProtID",
            "uniProtAC",
            "proteinName",
            "geneName",
            "organism",
            "sequenceLength",
            "subcellularLocalizations",
            "proteinFunction",
            "proteinSequence",
            "proteinSequenceFull",
            "lastUpdate",
            "message",
            "upstreamProteins",
        ],
        ""  # default
    )

class UniProtAioClient:
    def __init__(
        self,
        session: Optional[aiohttp.ClientSession] = None,
        timeout: float = 20.0,
        max_retries: int = 3,
        backoff_base: float = 0.5,
    ):
        self._external_session = session
        timeout_cfg = aiohttp.ClientTimeout(total=timeout)
        self._session = session or aiohttp.ClientSession(
            timeout=timeout_cfg,
            headers={"Accept": "application/json"},
        )
        self._max_retries = max_retries
        self._backoff_base = backoff_base

    async def __aenter__(self) -> "UniProtAioClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if not self._external_session:
            await self._session.close()

    async def get_json(self, url: str) -> Dict[str, Any]:
        for attempt in range(self._max_retries + 1):
            try:
                async with self._session.get(url) as resp:
                    # Retry on 429/5xx
                    if resp.status == 200:
                        return await resp.json()
                    if resp.status in (429, 500, 502, 503, 504) and attempt < self._max_retries:
                        await asyncio.sleep(self._backoff_base * (2 ** attempt))
                        continue
                    # Non-retryable or last attempt -> raise with detail
                    text = await resp.text()
                    raise aiohttp.ClientResponseError(
                        request_info=resp.request_info,
                        history=resp.history,
                        status=resp.status,
                        message=text,
                        headers=resp.headers,
                    )
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt < self._max_retries:
                    await asyncio.sleep(self._backoff_base * (2 ** attempt))
                    continue
                raise
        return {}

async def fetch_response_uniprot_trim(
    prot_id: str,
    session: Optional[aiohttp.ClientSession] = None,
) -> Dict[str, Any]:
    """
    Async version (aiohttp) returning the same shape as your original function.
    Handles normal, DELETED, and DEMERGED entries.
    """
    ret = init_return_dict()
    ret["upstreamProteins"] = {}

    async with UniProtAioClient(session=session) as up:
        try:
            entry_url = f"{UNIPROTKB_BASE}/{prot_id}"
            entry = await up.get_json(entry_url)

            inactive = entry.get("inactiveReason")
            if inactive:
                reason = inactive.get("inactiveReasonType", "")
                if "DELETED" in reason:
                    uni_parc_id = entry.get("extraAttributes", {}).get("uniParcId")
                    if not uni_parc_id:
                        ret["message"] = "Entry deleted and UniParc ID not available."
                        return ret

                    uni_parc = await up.get_json(f"{UNIPARC_BASE}/{uni_parc_id}")

                    xrefs = uni_parc.get("uniParcCrossReferences") or []
                    xr0 = xrefs[0] if xrefs else {}

                    ret["uniProtAC"] = xr0.get("id", "") or ""
                    ret["proteinName"] = xr0.get("proteinName", "") or ""
                    ret["geneName"] = xr0.get("geneName", "") or ""
                    org = xr0.get("organism") or {}
                    sci = org.get("scientificName") or ""
                    com = org.get("commonName")
                    ret["organism"] = f"{sci} ({com})" if com else sci

                    seq = uni_parc.get("sequence") or {}
                    ret["sequenceLength"] = seq.get("length", "")
                    ret["proteinSequence"] = seq.get("value", "")
                    ret["proteinSequenceFull"] = seq or {}
                    ret["lastUpdate"] = xr0.get("lastUpdated", "")

                    # Fetch extra info from UniProtKB using AC if present
                    if ret["uniProtAC"]:
                        deleted_replacement = await up.get_json(f"{UNIPROTKB_BASE}/{ret['uniProtAC']}")
                        ret["proteinFunction"] = first_text(deleted_replacement, "FUNCTION")
                        ret["uniProtID"] = deleted_replacement.get("uniProtkbId", "")
                        ret["upstreamProteins"] = get_ptms(deleted_replacement)
                        ret["subcellularLocalizations"] = parse_subcellular_localizations(deleted_replacement)
                    else:
                        ret["message"] = "Entry deleted; no UniProt AC cross-reference found."
                    return ret

                if "DEMERGED" in reason:
                    targets = inactive.get("mergeDemergeTo") or []
                    if not targets:
                        ret["message"] = "Entry demerged but target accession not listed."
                        return ret
                    target_ac = targets[0]
                    entry = await up.get_json(f"{UNIPROTKB_BASE}/{target_ac}")
                    # fall through to normal processing

            ret["upstreamProteins"] = get_ptms(entry)
            ret["uniProtID"] = entry.get("uniProtkbId", "")
            ret["uniProtAC"] = entry.get("primaryAccession", "")
            ret["proteinName"] = get_protein_name(entry)
            ret["geneName"] = get_gene_name(entry)
            ret["organism"] = get_organism(entry)

            seq = entry.get("sequence") or {}
            ret["sequenceLength"] = seq.get("length", "")
            ret["proteinSequence"] = seq.get("value", "")
            ret["proteinSequenceFull"] = seq or {}

            ret["proteinFunction"] = first_text(entry, "FUNCTION")
            ret["lastUpdate"] = (entry.get("entryAudit") or {}).get("lastSequenceUpdateDate", "")
            ret["subcellularLocalizations"] = parse_subcellular_localizations(entry)

        except aiohttp.ClientResponseError as e:
            ret["message"] = f"HTTP error: {e.status}"
        except Exception as e:
            ret["message"] = f"Error: {e}"

    return ret
