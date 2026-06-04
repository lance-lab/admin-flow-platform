from fastapi import FastAPI

app = FastAPI(title="Tenders Module API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "tenders-api"}


@app.get("/api/overview")
def overview() -> dict[str, object]:
    return {
        "module": "tenders",
        "status": "Ready",
        "capabilities": [
            "Tender schema scaffold",
            "Company registry verification planned",
            "Document generation planned",
            "Tender-company participant assignment planned",
        ],
    }
