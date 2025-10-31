"""We're going to define values' calculations here."""
import numpy as np

def get_longest_centered_array(values: list[float | int | str]) -> list[float]:
    zero_index = values.index(0)
    
    left, right = zero_index, zero_index
    left_steps, right_steps = 0, 0
    while left > 0 and values[left - 1] != '-inf':
        left -= 1
        left_steps += 1
    while right < len(values) - 1 and values[right + 1] != '-inf':
        right += 1
        right_steps += 1
    
    if left_steps > right_steps:
        extract_idx = right
    else:
        extract_idx = left
    
    return values[extract_idx:len(values) - extract_idx]


def additive_calculator(vector: list[float | int | str]) -> float:
    additive_score = 0.0
    if '-inf' in vector:
        additive_score = '-INF'
    else:
        for value in vector:
            if isinstance(value, float | int):
                additive_score += value
    return additive_score

def multiplicative_calculator(vector: list[float | str]) -> tuple[bool, dict]:
    # Logic here is that
    # We check if values persist at least as far as 6 positions
    # relative to the modification site.
    # If not, it's NIL.
    # If so, calculate only up to the point it can be allowed.
    vector = get_longest_centered_array(vector)
    if len(vector) < 13:
        return False, {'message': "Not enough upstream/downstream amino acids to make accurate calculation!", 'multiplicative_score': 'NIL', 'logLogProduct': 'NIL'}
    multiplicative_score = 1
    for idx, value in enumerate(vector):
        if (idx != (len(vector) // 2)) and (value == float(0) or value == '-inf'):
            return False, {'message': "Vector contains 0 or negative infinity!", 'multiplicative_score': 'NIL', 'logLogProduct': 'NIL'}
        if (idx != (len(vector) // 2)): # Skip over the center value.
            multiplicative_score *= value
    adjusted_multiplicative_score = np.log(abs(1 / (-1 * multiplicative_score)))
    return True, {'multiplicative_score': multiplicative_score, 'logLogProduct': adjusted_multiplicative_score}
