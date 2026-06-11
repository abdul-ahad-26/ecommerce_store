"""Transactional email via Resend.

A deliberately thin wrapper around Resend's REST API. The whole module is a
no-op when ``RESEND_API_KEY`` is unset — local dev and the test suite run with
no email account, and a sending failure is logged but never raised, so it can
never break checkout or auth.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from html import escape

import httpx

from app.core.config import settings
from app.models.order import Order

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"
_TIMEOUT = httpx.Timeout(10.0)


def _money(amount: Decimal) -> str:
    return f"Rs {amount:,.0f}"


async def send_email(to: str | list[str], subject: str, html: str) -> None:
    """Send one email. No-ops (logs) when Resend isn't configured.

    Never raises — callers (checkout, password reset) must not fail because an
    email could not be delivered.
    """
    recipients = [to] if isinstance(to, str) else [r for r in to if r]
    if not recipients:
        return
    if not settings.RESEND_API_KEY:
        logger.info("Email skipped (RESEND_API_KEY unset): %r → %s", subject, recipients)
        return

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.EMAIL_FROM,
                    "to": recipients,
                    "subject": subject,
                    "html": html,
                },
            )
            resp.raise_for_status()
    except Exception:  # noqa: BLE001 - email must never break the request
        logger.exception("Failed to send email %r to %s", subject, recipients)


def _order_items_table(order: Order) -> str:
    rows = "".join(
        f"<tr>"
        f"<td style='padding:6px 0;color:#2b2118'>{escape(item.product_name)}"
        + (
            f" <span style='color:#8a7b6b'>· {escape(item.variant_label)}</span>"
            if item.variant_label
            else ""
        )
        + f" × {item.qty}</td>"
        f"<td style='padding:6px 0;text-align:right;color:#2b2118'>{_money(item.line_total)}</td>"
        f"</tr>"
        for item in order.items
    )
    return (
        "<table style='width:100%;border-collapse:collapse;font-size:14px'>"
        f"{rows}"
        "</table>"
    )


def _order_summary_html(order: Order) -> str:
    address = ", ".join(
        p
        for p in (
            order.shipping_line1,
            order.shipping_line2,
            order.shipping_city,
            order.shipping_province,
            order.shipping_postal_code,
        )
        if p
    )
    order_url = f"{settings.FRONTEND_URL}/order/{order.order_number}"
    return f"""
    <div style="margin:18px 0;padding:16px;background:#f7f2ea;border:1px solid #e7ddcf">
      {_order_items_table(order)}
      <hr style="border:none;border-top:1px solid #e7ddcf;margin:12px 0" />
      <table style="width:100%;font-size:14px;color:#2b2118">
        <tr><td>Subtotal</td><td style="text-align:right">{_money(order.subtotal)}</td></tr>
        <tr><td>Shipping</td><td style="text-align:right">{_money(order.shipping_fee)}</td></tr>
        <tr><td style="font-weight:600;padding-top:6px">Total</td>
            <td style="text-align:right;font-weight:600;padding-top:6px">{_money(order.total)}</td></tr>
      </table>
    </div>
    <p style="font-size:14px;color:#2b2118"><strong>Deliver to:</strong> {escape(order.customer_name)},
       {escape(address)} — {escape(order.customer_phone)}</p>
    <p style="font-size:14px;color:#2b2118"><strong>Payment:</strong> Cash on Delivery</p>
    <p style="font-size:14px"><a href="{order_url}" style="color:#b14a33">View your order</a></p>
    """


def _shell(title: str, body: str) -> str:
    return f"""
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2b2118">
      <h1 style="font-size:22px;color:#b14a33;margin-bottom:4px">Meher</h1>
      <h2 style="font-size:18px;margin-top:16px">{title}</h2>
      {body}
      <p style="font-size:12px;color:#8a7b6b;margin-top:28px">
        Meher — Pakistani women's wear · Cash on Delivery nationwide
      </p>
    </div>
    """


async def send_order_confirmation(order: Order) -> None:
    """Email the customer their order receipt (only when an email was given)."""
    if not order.customer_email:
        return
    body = (
        f"<p style='font-size:14px'>Shukria, {escape(order.customer_name)}! "
        f"We've received your order <strong>{order.order_number}</strong> and will "
        "call to confirm before dispatch.</p>"
        f"{_order_summary_html(order)}"
    )
    await send_email(
        order.customer_email,
        f"Your Meher order {order.order_number}",
        _shell("Order confirmed", body),
    )


async def send_password_reset(to: str, reset_url: str) -> None:
    """Email a password-reset link."""
    body = (
        "<p style='font-size:14px'>We received a request to reset your Meher "
        "password. This link expires shortly and can only be used once.</p>"
        f"<p style='font-size:14px'><a href='{reset_url}' "
        "style='display:inline-block;background:#b14a33;color:#fff;padding:10px 18px;"
        "text-decoration:none;border-radius:2px'>Reset your password</a></p>"
        "<p style='font-size:12px;color:#8a7b6b'>If you didn't request this, "
        "you can safely ignore this email.</p>"
    )
    await send_email(to, "Reset your Meher password", _shell("Password reset", body))


async def send_new_order_alert(order: Order) -> None:
    """Notify the store owner that a new order needs dispatching."""
    if not settings.ADMIN_NOTIFICATION_EMAIL:
        return
    body = (
        f"<p style='font-size:14px'>New order <strong>{order.order_number}</strong> "
        f"from {escape(order.customer_name)} ({escape(order.customer_phone)}).</p>"
        f"{_order_summary_html(order)}"
    )
    await send_email(
        settings.ADMIN_NOTIFICATION_EMAIL,
        f"New order {order.order_number} — {_money(order.total)}",
        _shell("New order received", body),
    )
