"""Socket.io server: chat namespace, auth, room management.

Auth flow: client passes `auth: { token }` on connect. We decode the JWT,
load the User, and attach to the socket session. Disconnects clean up
presence and typing keys.

Events implemented (see docs/02-api.md §10 for full contract):
  client → server:
    conversation:join / leave
    typing:start / stop
    message:send
  server → client:
    presence:update / typing:update / message:created
    message:ai:start / delta / tool_use / complete / error
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.log import log
from app.main import sio
from app.models import ConversationParticipant, User
from app.orchestrator.streaming import run_chat_turn
from app.realtime.presence import touch_active, touch_chat


def _room(conversation_id: UUID | str) -> str:
    return f"conversation:{conversation_id}"


# -------------- connect / disconnect --------------


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    if not auth or not isinstance(auth, dict):
        log.info("sio.connect.rejected", reason="no_auth", sid=sid)
        return False
    token = auth.get("token")
    if not token:
        return False
    try:
        from app.core.auth import decode_access_token  # local to avoid cycles
        user_id = decode_access_token(token)
    except Exception:
        log.info("sio.connect.rejected", reason="bad_token", sid=sid)
        return False

    async with SessionLocal() as session:
        user = await session.get(User, user_id)
        if user is None:
            return False
        await sio.save_session(sid, {"user_id": str(user.id), "email": user.email})
        log.info("sio.connect", sid=sid, user_id=str(user.id))
    return True


@sio.event
async def disconnect(sid: str) -> None:
    log.info("sio.disconnect", sid=sid)


# -------------- conversation rooms --------------


@sio.event
async def conversation_join(sid: str, data: dict) -> None:
    conv_id = data.get("conversation_id")
    if not conv_id:
        return
    sess = await sio.get_session(sid)
    if not sess:
        return
    user_id = UUID(sess["user_id"])

    async with SessionLocal() as session:
        ok = await session.execute(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == UUID(conv_id),
                ConversationParticipant.user_id == user_id,
            )
        )
        if ok.scalar_one_or_none() is None:
            return  # not a participant; silently no-op

    await sio.enter_room(sid, _room(conv_id))
    await touch_active(user_id)
    await sio.emit(
        "presence:update",
        {"conversation_id": conv_id, "user_id": str(user_id), "online": True},
        room=_room(conv_id),
    )


@sio.event
async def conversation_leave(sid: str, data: dict) -> None:
    conv_id = data.get("conversation_id")
    if not conv_id:
        return
    sess = await sio.get_session(sid)
    user_id = sess.get("user_id") if sess else None
    await sio.leave_room(sid, _room(conv_id))
    if user_id:
        await sio.emit(
            "presence:update",
            {"conversation_id": conv_id, "user_id": user_id, "online": False},
            room=_room(conv_id),
        )


@sio.event
async def typing_start(sid: str, data: dict) -> None:
    sess = await sio.get_session(sid)
    if not sess or not data.get("conversation_id"):
        return
    await sio.emit(
        "typing:update",
        {
            "conversation_id": data["conversation_id"],
            "user_id": sess["user_id"],
            "typing": True,
        },
        room=_room(data["conversation_id"]),
        skip_sid=sid,
    )


@sio.event
async def typing_stop(sid: str, data: dict) -> None:
    sess = await sio.get_session(sid)
    if not sess or not data.get("conversation_id"):
        return
    await sio.emit(
        "typing:update",
        {
            "conversation_id": data["conversation_id"],
            "user_id": sess["user_id"],
            "typing": False,
        },
        room=_room(data["conversation_id"]),
        skip_sid=sid,
    )


# -------------- message:send --------------


@sio.event
async def message_send(sid: str, data: dict) -> dict[str, Any] | None:
    """Persist user message, broadcast, then run the AI turn streaming.

    Payload: { conversation_id, content_blocks, mode, parent_message_id?,
               attached_file_ids?, model_hint? }
    """
    sess = await sio.get_session(sid)
    if not sess:
        return {"error": "not_authenticated"}

    user_id = UUID(sess["user_id"])
    conv_id = data.get("conversation_id")
    if not conv_id:
        return {"error": "missing_conversation_id"}
    conv_uuid = UUID(conv_id)
    await touch_chat(user_id)

    try:
        await run_chat_turn(
            user_id=user_id,
            conversation_id=conv_uuid,
            content_blocks=data["content_blocks"],
            mode=data.get("mode", "ulzii"),
            parent_message_id=UUID(data["parent_message_id"]) if data.get("parent_message_id") else None,
            attached_file_ids=[UUID(x) for x in (data.get("attached_file_ids") or [])],
            model_hint=data.get("model_hint"),
            emit=lambda event, payload: sio.emit(event, payload, room=_room(conv_id)),
        )
        return {"ok": True}
    except Exception as exc:
        log.exception("message_send.error", error=str(exc), sid=sid)
        return {"error": str(exc)}
