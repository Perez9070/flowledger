from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import transactions, agent

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FlowLedger API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(agent.router)


@app.get("/health")
def health():
    return {"status": "ok"}
