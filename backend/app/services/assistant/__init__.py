"""AI shopping assistant — a tool-using "agent-lite" over the catalog/orders.

Read-only by design: tools query published catalog data and (auth-scoped) order
status. The only "write" is ``propose_cart_action``, which returns a structured
suggestion the *frontend* executes against the cart — the model never mutates
the database.
"""
