from dataclasses import dataclass


@dataclass(frozen=True)
class StatsPeriod:
    label: str
    days: int | None

    @classmethod
    def parse(cls, value: str) -> "StatsPeriod":
        if value in ("30d", "month"):
            return cls("month", 30)
        if value == "all":
            return cls("all", None)
        return cls("week", 7)
