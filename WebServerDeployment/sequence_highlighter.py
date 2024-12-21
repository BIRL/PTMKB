
def highlight_sequence(sequence: str):
    splits = [
        sequence[i:i + 10] for i in range(0, len(sequence), 10)
    ]
    response: list[tuple[str, int, int]] = []
    total: int = 0
    for i in range(len(splits)):
        response.append((splits[i], total, len(splits[i])))
        total += len(splits[i])
    return response