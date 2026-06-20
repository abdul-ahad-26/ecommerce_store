"""Static store policy / FAQ text served via the ``get_store_policy`` tool.

Small and static, so it lives in code (no RAG needed). Keep entries short and
factual — the model paraphrases them into the conversation.
"""

# topic key -> policy text. Keep keys lowercase and stable; they're part of the
# tool's enum surface.
POLICIES: dict[str, str] = {
    "shipping": (
        "We deliver across Pakistan. Orders are dispatched within 1–2 working "
        "days and typically arrive in 3–5 working days. Shipping is a flat "
        "Rs 200, and free on orders of Rs 5,000 or more."
    ),
    "cod": (
        "Cash on Delivery (COD) is our default payment method — pay the courier "
        "in cash when your order arrives. No advance payment is required."
    ),
    "returns": (
        "Unworn items with tags can be exchanged or returned within 7 days of "
        "delivery. Stitched-to-order and sale items are final. Contact us to "
        "start a return."
    ),
    "sizing": (
        "Stitched pieces follow standard small/medium/large sizing; check each "
        "product's size details. Unstitched fabric is sold as uncut yardage for "
        "your own tailoring."
    ),
    "fabric_care": (
        "Most lawn and cotton pieces are best hand-washed or machine-washed cold "
        "and dried in shade. Follow the care note on each product where given."
    ),
    "contact": (
        "Reach us through the website's contact page for any order or product "
        "question — we usually reply within a day."
    ),
}

# Stable list of valid topics, surfaced to the model in the tool schema.
POLICY_TOPICS = sorted(POLICIES.keys())
