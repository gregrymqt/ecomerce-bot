from pydantic import BaseModel
from typing import List

class DemoRequest(BaseModel):
    urls: List[str]
